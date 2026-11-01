import "server-only";
import { connection } from "next/server";
import { and, asc, count, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { ballots, options, polls, votes } from "@/db/schema";
import { isOnBallot } from "@/domain/poll-machine";
import type { AvatarTint } from "@/domain/rules";
import type { Tally } from "@/domain/standings";
import { settleExpired } from "./poll-service";

export interface Person {
  name: string;
  avatarSeed: string;
  avatarTint: AvatarTint;
}

export interface BallotOption extends Tally {
  suggestedBy: Person | null;
}

export interface PendingSuggestion {
  id: string;
  label: string;
  suggestedBy: Person;
}

export async function getCreatorPoll(
  pollId: string,
  creatorId: string,
  /** Tests pass a fixed time; otherwise the request time. */
  nowOverride?: Date,
) {
  // Reads the clock (lazy settling): per request, never prerendered
  await connection();
  const now = nowOverride ?? new Date();
  await settleExpired({ pollId }, now);

  const [poll] = await db
    .select({
      id: polls.id,
      title: polls.title,
      type: polls.type,
      maxChoices: polls.maxChoices,
      suggestionsEnabled: polls.suggestionsEnabled,
      status: polls.status,
      closesAt: polls.closesAt,
      settledAt: polls.settledAt,
      settledEarly: polls.settledEarly,
    })
    .from(polls)
    .where(and(eq(polls.id, pollId), eq(polls.creatorId, creatorId)));
  // Someone else's poll is indistinguishable from a missing one
  if (!poll) return null;

  const [optionRows, [ballotStats]] = await Promise.all([
    db
      .select({
        id: options.id,
        label: options.label,
        source: options.source,
        suggestionStatus: options.suggestionStatus,
        decidedAt: options.decidedAt,
        suggestedByName: options.suggestedByName,
        suggestedByAvatarSeed: options.suggestedByAvatarSeed,
        suggestedByAvatarTint: options.suggestedByAvatarTint,
        votes: count(votes.optionId),
      })
      .from(options)
      .leftJoin(votes, eq(votes.optionId, options.id))
      .where(eq(options.pollId, poll.id))
      .groupBy(options.id)
      .orderBy(asc(options.position)),
    db
      .select({ voters: count(), lastCastAt: max(ballots.castAt) })
      .from(ballots)
      .where(eq(ballots.pollId, poll.id)),
  ]);

  const suggestedBy = (o: (typeof optionRows)[number]): Person | null =>
    o.suggestedByName && o.suggestedByAvatarSeed && o.suggestedByAvatarTint
      ? {
          name: o.suggestedByName,
          avatarSeed: o.suggestedByAvatarSeed,
          avatarTint: o.suggestedByAvatarTint as AvatarTint,
        }
      : null;

  const ballotOptions: BallotOption[] = optionRows
    .filter(isOnBallot)
    .map((o) => ({
      id: o.id,
      label: o.label,
      votes: o.votes,
      suggestedBy: suggestedBy(o),
    }));
  const pending: PendingSuggestion[] = optionRows
    .filter((o) => o.suggestionStatus === "pending")
    .map((o) => ({ id: o.id, label: o.label, suggestedBy: suggestedBy(o)! }));

  return {
    ...poll,
    voters: ballotStats?.voters ?? 0,
    lastCastAt: ballotStats?.lastCastAt ?? null,
    ballotOptions,
    pending,
    // Who backed what is revealed only once voting has ended: while open,
    // this query never selects voter names.
    backers: poll.status === "settled" ? await loadBackers(poll.id) : null,
  };
}

export type CreatorPoll = NonNullable<
  Awaited<ReturnType<typeof getCreatorPoll>>
>;

/** Voters per option id, in the order they voted. */
export async function loadBackers(
  pollId: string,
): Promise<Record<string, Person[]>> {
  const rows = await db
    .select({
      optionId: votes.optionId,
      name: ballots.voterName,
      avatarSeed: ballots.avatarSeed,
      avatarTint: ballots.avatarTint,
    })
    .from(votes)
    .innerJoin(ballots, eq(ballots.id, votes.ballotId))
    .where(eq(ballots.pollId, pollId))
    .orderBy(asc(ballots.castAt));

  const backers: Record<string, Person[]> = {};
  for (const { optionId, ...person } of rows) {
    (backers[optionId] ??= []).push({
      ...person,
      avatarTint: person.avatarTint as AvatarTint,
    });
  }
  return backers;
}
