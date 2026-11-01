import "server-only";
import { asc, count, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { ballots, options, polls, users, votes } from "@/db/schema";
import { isOnBallot } from "@/domain/poll-machine";
import type { AvatarTint } from "@/domain/rules";
import { loadBackers, type BallotOption, type Person } from "./poll-view";
import { settleExpired } from "./poll-service";

// The vote page's view of a poll, public by link (the unguessable id is the
// access control). What it reveals depends on where the voter is:
// - not voted, poll open: the ballot only. No counts leave the server, so
//   nobody sees the race before voting, not even in the page payload.
// - voted, poll open: counts too, never who voted for what.
// - settled: everything, backers included.

export interface MyBallot extends Person {
  optionIds: string[];
}

export async function getPublicPoll(
  pollId: string,
  voterToken: string | null,
  now = new Date(),
) {
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
      creatorName: users.name,
    })
    .from(polls)
    .innerJoin(users, eq(users.id, polls.creatorId))
    .where(eq(polls.id, pollId));
  if (!poll) return null;

  const [optionRows, [{ voters }], myBallot] = await Promise.all([
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
      .select({ voters: count() })
      .from(ballots)
      .where(eq(ballots.pollId, poll.id)),
    voterToken ? loadMyBallot(poll.id, voterToken) : null,
  ]);

  const settled = poll.status === "settled";
  const canSeeCounts = settled || myBallot !== null;

  const ballotOptions: BallotOption[] = optionRows
    .filter(isOnBallot)
    .map((o) => ({
      id: o.id,
      label: o.label,
      votes: canSeeCounts ? o.votes : 0,
      suggestedBy:
        o.suggestedByName && o.suggestedByAvatarSeed && o.suggestedByAvatarTint
          ? {
              name: o.suggestedByName,
              avatarSeed: o.suggestedByAvatarSeed,
              avatarTint: o.suggestedByAvatarTint as AvatarTint,
            }
          : null,
    }));

  const { creatorName, ...rest } = poll;
  return {
    ...rest,
    /** First name only: voters don't need the creator's full name. */
    creatorFirstName: creatorName.trim().split(/\s+/)[0] || "Someone",
    ballotOptions,
    myBallot,
    canSeeCounts,
    voters: canSeeCounts ? voters : 0,
    backers: settled ? await loadBackers(poll.id) : null,
  };
}

export type PublicPoll = NonNullable<Awaited<ReturnType<typeof getPublicPoll>>>;

async function loadMyBallot(
  pollId: string,
  voterToken: string,
): Promise<MyBallot | null> {
  const rows = await db
    .select({
      name: ballots.voterName,
      avatarSeed: ballots.avatarSeed,
      avatarTint: ballots.avatarTint,
      optionId: votes.optionId,
    })
    .from(ballots)
    .innerJoin(votes, eq(votes.ballotId, ballots.id))
    .where(and(eq(ballots.pollId, pollId), eq(ballots.voterToken, voterToken)));
  if (rows.length === 0) return null;
  const [{ name, avatarSeed, avatarTint }] = rows;
  return {
    name,
    avatarSeed,
    avatarTint: avatarTint as AvatarTint,
    optionIds: rows.map((r) => r.optionId),
  };
}
