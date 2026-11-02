import "server-only";
import { connection } from "next/server";
import { count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ballots, options, polls, votes } from "@/db/schema";
import { isOnBallot } from "@/domain/poll-machine";
import type { PollStatus, PollType } from "@/domain/rules";
import { computeStanding, type Standing } from "@/domain/standings";
import { settleExpired } from "./poll-service";

export interface DashboardPoll {
  id: string;
  title: string;
  type: PollType;
  status: PollStatus;
  closesAt: Date;
  settledAt: Date | null;
  settledEarly: boolean;
  voters: number;
  pendingSuggestions: number;
  standing: Standing;
}

export interface Dashboard {
  /** The open poll closing soonest: "what needs my attention?" */
  featured: DashboardPoll | null;
  open: DashboardPoll[];
  settled: DashboardPoll[];
}

export async function getDashboard(
  creatorId: string,
  /** Tests pass a fixed time; otherwise the request time. */
  nowOverride?: Date,
): Promise<Dashboard> {
  // Reads the clock (lazy settling): per request, never prerendered
  await connection();
  const now = nowOverride ?? new Date();
  // Record deadlines that passed while nobody was looking
  await settleExpired({ creatorId }, now);

  const pollRows = await db
    .select({
      id: polls.id,
      title: polls.title,
      type: polls.type,
      status: polls.status,
      closesAt: polls.closesAt,
      settledAt: polls.settledAt,
      settledEarly: polls.settledEarly,
    })
    .from(polls)
    .where(eq(polls.creatorId, creatorId));
  if (pollRows.length === 0) return { featured: null, open: [], settled: [] };

  const pollIds = pollRows.map((p) => p.id);
  const [optionRows, voterRows] = await Promise.all([
    db
      .select({
        id: options.id,
        pollId: options.pollId,
        label: options.label,
        source: options.source,
        suggestionStatus: options.suggestionStatus,
        decidedAt: options.decidedAt,
        votes: count(votes.optionId),
      })
      .from(options)
      .leftJoin(votes, eq(votes.optionId, options.id))
      .where(inArray(options.pollId, pollIds))
      .groupBy(options.id),
    db
      .select({ pollId: ballots.pollId, voters: count() })
      .from(ballots)
      .where(inArray(ballots.pollId, pollIds))
      .groupBy(ballots.pollId),
  ]);

  const votersByPoll = new Map(voterRows.map((r) => [r.pollId, r.voters]));
  const summaries = pollRows.map((poll): DashboardPoll => {
    const pollOptions = optionRows.filter((o) => o.pollId === poll.id);
    return {
      ...poll,
      voters: votersByPoll.get(poll.id) ?? 0,
      pendingSuggestions: pollOptions.filter(
        (o) => o.suggestionStatus === "pending",
      ).length,
      standing: computeStanding(pollOptions.filter(isOnBallot)),
    };
  });

  const open = summaries
    .filter((p) => p.status === "open")
    .sort((a, b) => a.closesAt.getTime() - b.closesAt.getTime());
  const settled = summaries
    .filter((p) => p.status === "settled")
    .sort((a, b) => b.settledAt!.getTime() - a.settledAt!.getTime());

  return { featured: open[0] ?? null, open: open.slice(1), settled };
}
