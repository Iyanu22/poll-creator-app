import "server-only";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { polls } from "@/db/schema";

/**
 * Just enough to title a poll's pages ("Pizza night: live results").
 * Settled-ness accounts for a deadline that passed without anyone looking,
 * since lazy settling may not have written it yet.
 */
export async function getPollMeta(pollId: string) {
  await connection();
  const [poll] = await db
    .select({
      title: polls.title,
      creatorId: polls.creatorId,
      status: polls.status,
      closesAt: polls.closesAt,
    })
    .from(polls)
    .where(eq(polls.id, pollId));
  if (!poll) return null;
  return {
    title: poll.title,
    creatorId: poll.creatorId,
    settled: poll.status === "settled" || poll.closesAt <= new Date(),
  };
}

export const POLL_NOT_FOUND_TITLE = "Poll not found";
