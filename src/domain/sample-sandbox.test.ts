import { describe, expect, it } from "vitest";
import { SAMPLE_NOW, buildSandbox, type SandboxRows } from "./sample-sandbox";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-11-01T12:00:00Z");

function build(at = now): SandboxRows {
  let n = 0;
  return buildSandbox({
    creatorId: "guest-1",
    now: at,
    newPollId: () => `poll-${++n}`,
    newUuid: () => `uuid-${++n}`,
  });
}

function pollByTitle(rows: SandboxRows, start: string) {
  const poll = rows.polls.find((p) => p.title.startsWith(start));
  if (!poll) throw new Error(`No poll titled ${start}…`);
  return poll;
}

function tally(rows: SandboxRows, pollId: string) {
  return rows.options
    .filter((o) => o.pollId === pollId)
    .map((o) => rows.votes.filter((v) => v.optionId === o.id).length);
}

describe("buildSandbox", () => {
  it("copies all 5 polls and 32 votes for the guest", () => {
    const rows = build();
    expect(rows.polls).toHaveLength(5);
    expect(rows.votes).toHaveLength(32);
    expect(rows.polls.every((p) => p.creatorId === "guest-1")).toBe(true);
  });

  it("keeps the story intact: pizza night 5/3/2/1, film club tie for second", () => {
    const rows = build();
    const pizza = pollByTitle(rows, "Pizza night");
    expect(tally(rows, pizza.id)).toEqual([5, 3, 2, 1, 0]);

    const film = pollByTitle(rows, "Friday film club");
    const filmTally = tally(rows, film.id).sort((a, b) => b - a);
    expect(filmTally).toEqual([3, 2, 2]);
  });

  it("shifts time so open polls are genuinely open, keeping offsets", () => {
    const rows = build();
    const pizza = pollByTitle(rows, "Pizza night");
    // Sample: closes 18:00 when "now" is 15:00
    expect(pizza.closesAt.getTime() - now.getTime()).toBe(3 * HOUR);

    for (const poll of rows.polls) {
      if (poll.status === "open") {
        expect(poll.closesAt > now).toBe(true);
        expect(poll.settledAt).toBeNull();
      } else {
        expect(poll.settledAt!.getTime()).toBeLessThanOrEqual(now.getTime());
      }
    }
  });

  it("marks meal-out as ended early and lake weekend as settled on time", () => {
    const rows = build();
    const settled = rows.polls.filter((p) => p.status === "settled");
    expect(settled).toHaveLength(2);
    expect(settled.filter((p) => p.settledEarly)).toHaveLength(1);
    for (const p of settled) {
      expect(p.settledEarly).toBe(p.settledAt! < p.closesAt);
    }
  });

  it("satisfies the options_source_shape constraint", () => {
    for (const o of build().options) {
      if (o.source === "creator") {
        expect(o.suggestionStatus).toBeNull();
        expect(o.suggestedByName).toBeNull();
        expect(o.decidedAt).toBeNull();
      } else {
        expect(o.suggestedByName).not.toBeNull();
        expect(o.suggestedByAvatarTint).not.toBeNull();
        expect(o.decidedAt === null).toBe(o.suggestionStatus === "pending");
      }
    }
  });

  it("places suggestion timestamps in a plausible order", () => {
    const rows = build();
    for (const o of rows.options.filter((o) => o.source === "suggestion")) {
      const poll = rows.polls.find((p) => p.id === o.pollId)!;
      expect(o.createdAt >= poll.createdAt).toBe(true);
      expect(o.createdAt <= now).toBe(true);

      const castTimes = rows.votes
        .filter((v) => v.optionId === o.id)
        .map((v) => rows.ballots.find((b) => b.id === v.ballotId)!.castAt);
      if (o.decidedAt) {
        expect(o.createdAt <= o.decidedAt).toBe(true);
        for (const castAt of castTimes)
          expect(o.decidedAt <= castAt).toBe(true);
      } else {
        expect(castTimes).toHaveLength(0); // pending: not on the ballot
      }
    }
  });

  it("only links votes to options and ballots of the same poll", () => {
    const rows = build();
    const optionPoll = new Map(rows.options.map((o) => [o.id, o.pollId]));
    const ballotPoll = new Map(rows.ballots.map((b) => [b.id, b.pollId]));
    for (const v of rows.votes) {
      expect(optionPoll.get(v.optionId)).toBe(ballotPoll.get(v.ballotId));
    }
  });

  it("gives every sandbox fresh ids", () => {
    let n = 0;
    const ids = { newPollId: () => `p${++n}`, newUuid: () => `u${++n}` };
    const a = buildSandbox({ creatorId: "a", now, ...ids });
    const b = buildSandbox({ creatorId: "b", now, ...ids });
    const aIds = new Set(a.polls.map((p) => p.id));
    expect(b.polls.some((p) => aIds.has(p.id))).toBe(false);
  });

  it("reproduces the sample's own timestamps when now is SAMPLE_NOW", () => {
    const pizza = pollByTitle(build(SAMPLE_NOW), "Pizza night");
    expect(pizza.closesAt.toISOString()).toBe("2026-09-17T18:00:00.000Z");
  });
});
