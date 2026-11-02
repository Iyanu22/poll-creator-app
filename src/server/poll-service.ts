// The server-side referee. Every write runs in a transaction that locks the
// poll row first (SELECT … FOR UPDATE), applies lazy settling, then checks
// the transition with the pure rules in domain/poll-machine. A vote racing
// "End voting" therefore sees the poll either before or after, never mid-way.

import { and, eq, lte, max, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { ballots, options, polls, votes, type Poll } from "@/db/schema";
import {
  assertCanCast,
  assertCanSuggest,
  expiredSettlement,
  planApprove,
  planDecline,
  planEndEarly,
  planReopen,
  planUndoDecline,
  resolveRecast,
  RuleError,
} from "@/domain/poll-machine";
import {
  validateDraft,
  type DraftErrors,
  type PollDraft,
} from "@/domain/poll-draft";
import type { AvatarTint } from "@/domain/rules";

export interface VoterIdentity {
  name: string;
  avatarSeed: string;
  avatarTint: AvatarTint;
}

// ── Locking + lazy settling ──────────────────────────────────────────────

async function lockPoll(tx: Tx, pollId: string, now: Date): Promise<Poll> {
  const [poll] = await tx
    .select()
    .from(polls)
    .where(eq(polls.id, pollId))
    .for("update");
  if (!poll) throw new RuleError("POLL_NOT_FOUND", "That poll doesn't exist.");

  const settlement = expiredSettlement(poll, now);
  if (!settlement) return poll;
  await tx.update(polls).set(settlement).where(eq(polls.id, pollId));
  return { ...poll, ...settlement };
}

/** Someone else's poll is indistinguishable from a missing one. */
async function lockOwnPoll(
  tx: Tx,
  pollId: string,
  creatorId: string,
  now: Date,
): Promise<Poll> {
  const poll = await lockPoll(tx, pollId, now);
  if (poll.creatorId !== creatorId) {
    throw new RuleError("POLL_NOT_FOUND", "That poll doesn't exist.");
  }
  return poll;
}

const optionStateColumns = {
  id: options.id,
  label: options.label,
  source: options.source,
  suggestionStatus: options.suggestionStatus,
  decidedAt: options.decidedAt,
};

function loadOptions(tx: Tx, pollId: string) {
  return tx
    .select(optionStateColumns)
    .from(options)
    .where(eq(options.pollId, pollId));
}

async function loadSuggestion(tx: Tx, pollId: string, optionId: string) {
  const [option] = await tx
    .select(optionStateColumns)
    .from(options)
    .where(and(eq(options.id, optionId), eq(options.pollId, pollId)));
  if (!option) {
    throw new RuleError(
      "SUGGESTION_NOT_FOUND",
      "That suggestion doesn't exist.",
    );
  }
  return option;
}

/**
 * For read paths (results, dashboard): record any deadline that passed while
 * nobody was looking. A single conditional UPDATE, so no lock is needed.
 */
export async function settleExpired(
  where: { pollId: string } | { creatorId: string },
  now = new Date(),
): Promise<void> {
  await db
    .update(polls)
    .set({
      status: "settled",
      settledAt: sql`${polls.closesAt}`,
      settledEarly: false,
    })
    .where(
      and(
        "pollId" in where
          ? eq(polls.id, where.pollId)
          : eq(polls.creatorId, where.creatorId),
        eq(polls.status, "open"),
        lte(polls.closesAt, now),
      ),
    );
}

// ── Voting ───────────────────────────────────────────────────────────────

export async function castBallot(
  input: {
    pollId: string;
    voterToken: string;
    voter: VoterIdentity;
    optionIds: string[];
  },
  now = new Date(),
): Promise<{ ballotId: string; replayed: boolean }> {
  return db.transaction(async (tx) => {
    const poll = await lockPoll(tx, input.pollId, now);

    // Replay check first: a voter retrying a cast that already landed gets
    // success, even if the poll has since settled.
    const [existing] = await tx
      .select({ id: ballots.id })
      .from(ballots)
      .where(
        and(
          eq(ballots.pollId, poll.id),
          eq(ballots.voterToken, input.voterToken),
        ),
      );
    if (existing) {
      const picks = await tx
        .select({ optionId: votes.optionId })
        .from(votes)
        .where(eq(votes.ballotId, existing.id));
      resolveRecast(
        picks.map((p) => p.optionId),
        input.optionIds,
      );
      return { ballotId: existing.id, replayed: true };
    }

    assertCanCast(poll, await loadOptions(tx, poll.id), input.optionIds, now);

    const [ballot] = await tx
      .insert(ballots)
      .values({
        pollId: poll.id,
        voterToken: input.voterToken,
        voterName: input.voter.name,
        avatarSeed: input.voter.avatarSeed,
        avatarTint: input.voter.avatarTint,
        castAt: now,
      })
      .returning({ id: ballots.id });
    await tx
      .insert(votes)
      .values(
        input.optionIds.map((optionId) => ({ ballotId: ballot.id, optionId })),
      );

    return { ballotId: ballot.id, replayed: false };
  });
}

// ── Poll lifecycle (creator only) ────────────────────────────────────────

/**
 * Creates a poll from a draft. Validates again with the same rules the form
 * used, so a hand-crafted request can't create what the form wouldn't.
 */
export async function createPoll(
  creatorId: string,
  draft: PollDraft,
  now = new Date(),
): Promise<{ pollId: string } | { errors: DraftErrors }> {
  const result = validateDraft(draft, now);
  if (!result.ok) return { errors: result.errors };
  const { options: labels, ...poll } = result.poll;

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(polls)
      .values({ ...poll, creatorId, createdAt: now, updatedAt: now })
      .returning({ id: polls.id });
    await tx.insert(options).values(
      labels.map((label, position) => ({
        pollId: created.id,
        label,
        position,
        source: "creator" as const,
        createdAt: now,
      })),
    );
    return { pollId: created.id };
  });
}

export async function endVoting(
  pollId: string,
  creatorId: string,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    const poll = await lockOwnPoll(tx, pollId, creatorId, now);
    await tx
      .update(polls)
      .set(planEndEarly(poll, now))
      .where(eq(polls.id, poll.id));
  });
}

export async function reopenVoting(
  pollId: string,
  creatorId: string,
  closesAt: Date,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    const poll = await lockOwnPoll(tx, pollId, creatorId, now);
    await tx
      .update(polls)
      .set(planReopen(poll, closesAt, now))
      .where(eq(polls.id, poll.id));
  });
}

// ── Suggestions ──────────────────────────────────────────────────────────

export async function suggestOption(
  input: { pollId: string; label: string; suggestedBy: VoterIdentity },
  now = new Date(),
): Promise<{ optionId: string }> {
  return db.transaction(async (tx) => {
    const poll = await lockPoll(tx, input.pollId, now);
    const label = input.label.trim().replace(/\s+/g, " ");
    assertCanSuggest(poll, await loadOptions(tx, poll.id), label, now);

    const [{ last }] = await tx
      .select({ last: max(options.position) })
      .from(options)
      .where(eq(options.pollId, poll.id));
    const [option] = await tx
      .insert(options)
      .values({
        pollId: poll.id,
        label,
        position: (last ?? -1) + 1,
        source: "suggestion",
        suggestionStatus: "pending",
        suggestedByName: input.suggestedBy.name,
        suggestedByAvatarSeed: input.suggestedBy.avatarSeed,
        suggestedByAvatarTint: input.suggestedBy.avatarTint,
        createdAt: now,
      })
      .returning({ id: options.id });
    return { optionId: option.id };
  });
}

export async function approveSuggestion(
  pollId: string,
  optionId: string,
  creatorId: string,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    const poll = await lockOwnPoll(tx, pollId, creatorId, now);
    const all = await loadOptions(tx, poll.id);
    const suggestion = await loadSuggestion(tx, poll.id, optionId);
    await tx
      .update(options)
      .set(planApprove(poll, all, suggestion, now))
      .where(eq(options.id, suggestion.id));
  });
}

export async function declineSuggestion(
  pollId: string,
  optionId: string,
  creatorId: string,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    const poll = await lockOwnPoll(tx, pollId, creatorId, now);
    const suggestion = await loadSuggestion(tx, poll.id, optionId);
    await tx
      .update(options)
      .set(planDecline(suggestion, now))
      .where(eq(options.id, suggestion.id));
  });
}

export async function undoDeclineSuggestion(
  pollId: string,
  optionId: string,
  creatorId: string,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    const poll = await lockOwnPoll(tx, pollId, creatorId, now);
    const suggestion = await loadSuggestion(tx, poll.id, optionId);
    await tx
      .update(options)
      .set(planUndoDecline(suggestion, now))
      .where(eq(options.id, suggestion.id));
  });
}
