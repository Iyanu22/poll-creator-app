import { and, count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { ballots, options, polls, users } from "@/db/schema";
import { castBallot, endVoting, settleExpired } from "./poll-service";

// The locking around votes, against a real Postgres: what the pure rules'
// tests can't show. Run with `pnpm test:db` (DATABASE_URL from .env.local).
// Everything hangs off one throwaway user, deleted at the end; the rows
// cascade with it.

const userId = `test-${nanoid()}`;
const voter = {
  name: "Lock Test",
  avatarSeed: "Mila",
  avatarTint: "f8c9b9" as const,
};

beforeAll(async () => {
  await db
    .insert(users)
    .values({ id: userId, name: "Lock Test", email: `${userId}@example.test` });
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, userId));
});

async function newPoll(closesAt = new Date(Date.now() + 60 * 60 * 1000)) {
  const [poll] = await db
    .insert(polls)
    .values({ creatorId: userId, title: "Lock test", closesAt })
    .returning({ id: polls.id });
  const [option] = await db
    .insert(options)
    .values({ pollId: poll.id, label: "Yes", position: 0, source: "creator" })
    .returning({ id: options.id });
  return { pollId: poll.id, optionId: option.id };
}

const cast = (pollId: string, optionId: string, voterToken = nanoid()) =>
  castBallot({ pollId, voterToken, voter, optionIds: [optionId] });

/**
 * Locks the poll row in a transaction that stays open, running `then`
 * inside it, until the returned release is called.
 */
async function holdPoll(
  pollId: string,
  mode: "share" | "update",
  then?: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => unknown,
) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let held!: () => void;
  const isHeld = new Promise<void>((resolve) => (held = resolve));
  const done = db.transaction(async (tx) => {
    await tx
      .select({ id: polls.id })
      .from(polls)
      .where(eq(polls.id, pollId))
      .for(mode);
    await then?.(tx);
    held();
    await released;
  });
  await isHeld;
  return async () => {
    release();
    await done;
  };
}

/** True if the promise settles (either way) within `ms`. */
function settlesWithin(promise: Promise<unknown>, ms: number) {
  return Promise.race([
    promise.then(
      () => true,
      () => true,
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);
}

describe("castBallot under concurrency", () => {
  it("lets a whole chat vote at once instead of one by one", async () => {
    const { pollId, optionId } = await newPoll();
    await cast(pollId, optionId); // warm the connection pool

    let started = performance.now();
    await cast(pollId, optionId);
    const oneVote = performance.now() - started;

    started = performance.now();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => cast(pollId, optionId)),
    );
    const eightVotes = performance.now() - started;

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    // In a single line, eight votes take about eight times one vote
    expect(eightVotes).toBeLessThan(oneVote * 3);
  });

  it("keeps a double tap to one ballot, and both taps succeed", async () => {
    const { pollId, optionId } = await newPoll();
    for (let round = 0; round < 5; round++) {
      const token = nanoid();
      const taps = await Promise.allSettled([
        cast(pollId, optionId, token),
        cast(pollId, optionId, token),
      ]);
      expect(taps.map((t) => t.status)).toEqual(["fulfilled", "fulfilled"]);
      const [a, b] = taps.map(
        (t) => (t as PromiseFulfilledResult<{ ballotId: string }>).value,
      );
      expect(a.ballotId).toBe(b.ballotId);
      const [{ ballotsForToken }] = await db
        .select({ ballotsForToken: count() })
        .from(ballots)
        .where(and(eq(ballots.pollId, pollId), eq(ballots.voterToken, token)));
      expect(ballotsForToken).toBe(1);
    }
  });

  it("makes End voting wait for a vote in flight", async () => {
    const { pollId } = await newPoll();
    // What a vote holds while it's being cast
    const release = await holdPoll(pollId, "share");
    const ending = endVoting(pollId, userId);
    try {
      expect(await settlesWithin(ending, 1500)).toBe(false);
    } finally {
      await release();
    }
    await ending;
  });

  it("makes a vote wait for End voting, then refuses it", async () => {
    const { pollId, optionId } = await newPoll();
    // End voting mid-way: poll locked and marked settled, not yet committed
    const release = await holdPoll(pollId, "update", (tx) =>
      tx
        .update(polls)
        .set({ status: "settled", settledAt: new Date(), settledEarly: true })
        .where(eq(polls.id, pollId)),
    );
    const voting = cast(pollId, optionId);
    try {
      expect(await settlesWithin(voting, 1500)).toBe(false);
    } finally {
      await release();
    }
    await expect(voting).rejects.toMatchObject({ code: "POLL_SETTLED" });
  });

  it("refuses a vote past the deadline; the next read records it", async () => {
    const { pollId, optionId } = await newPoll(new Date(Date.now() - 60_000));
    await expect(cast(pollId, optionId)).rejects.toMatchObject({
      code: "POLL_SETTLED",
    });
    const statusOf = async () =>
      (
        await db
          .select({ status: polls.status })
          .from(polls)
          .where(eq(polls.id, pollId))
      )[0].status;
    expect(await statusOf()).toBe("open");
    await settleExpired({ pollId });
    expect(await statusOf()).toBe("settled");
  });
});
