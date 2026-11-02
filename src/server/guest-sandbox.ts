import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { ballots, options, pollSlug, polls, users, votes } from "@/db/schema";
import { GUEST_SANDBOX_TTL_MS } from "@/domain/rules";
import { buildSandbox } from "@/domain/sample-sandbox";

/** Gives a new guest their own copy of the sample polls, all or nothing. */
export async function seedGuestSandbox(userId: string, now = new Date()) {
  const rows = buildSandbox({
    creatorId: userId,
    now,
    newPollId: pollSlug,
    newUuid: () => crypto.randomUUID(),
  });

  await db.transaction(async (tx) => {
    await tx.insert(polls).values(rows.polls);
    await tx.insert(options).values(rows.options);
    await tx.insert(ballots).values(rows.ballots);
    await tx.insert(votes).values(rows.votes);
  });
}

/**
 * Deletes guests older than the sandbox lifetime. Their sessions, polls,
 * options, ballots and votes all go with them via ON DELETE CASCADE.
 */
export async function deleteExpiredGuests(now = new Date()) {
  const cutoff = new Date(now.getTime() - GUEST_SANDBOX_TTL_MS);
  const deleted = await db
    .delete(users)
    .where(and(eq(users.isAnonymous, true), lt(users.createdAt, cutoff)))
    .returning({ id: users.id });
  return deleted.length;
}
