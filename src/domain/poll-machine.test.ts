import { describe, expect, it } from "vitest";
import {
  assertCanCast,
  assertCanSuggest,
  effectiveStatus,
  expiredSettlement,
  planApprove,
  planDecline,
  planEndEarly,
  planReopen,
  planUndoDecline,
  resolveRecast,
  RuleError,
  type OptionState,
  type PollState,
  type RuleErrorCode,
} from "./poll-machine";
import { DECLINE_UNDO_WINDOW_MS, MAX_OPTIONS } from "./rules";

const NOW = new Date("2026-09-17T15:00:00Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

const openPoll = (over: Partial<PollState> = {}): PollState => ({
  status: "open",
  type: "single",
  maxChoices: 1,
  suggestionsEnabled: true,
  closesAt: minutes(180),
  settledAt: null,
  settledEarly: false,
  ...over,
});

const settledPoll = (over: Partial<PollState> = {}): PollState =>
  openPoll({
    status: "settled",
    closesAt: minutes(-60),
    settledAt: minutes(-60),
    ...over,
  });

const creatorOption = (id: string, label = id): OptionState => ({
  id,
  label,
  source: "creator",
  suggestionStatus: null,
  decidedAt: null,
});

const suggestion = (
  id: string,
  status: OptionState["suggestionStatus"],
  over: Partial<OptionState> = {},
): OptionState => ({
  id,
  label: id,
  source: "suggestion",
  suggestionStatus: status,
  decidedAt: status === "pending" ? null : minutes(-1),
  ...over,
});

function expectRule(fn: () => unknown, code: RuleErrorCode) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(RuleError);
    expect((e as RuleError).code).toBe(code);
    return;
  }
  throw new Error(`Expected RuleError ${code}, but nothing was thrown`);
}

const pizza = [
  creatorOption("pepperoni"),
  creatorOption("margherita"),
  suggestion("detroit", "approved"),
  suggestion("salads", "pending"),
  suggestion("pineapple", "declined"),
];

describe("poll lifecycle", () => {
  it("is open before the deadline and settled at it (not one ms later)", () => {
    const poll = openPoll({ closesAt: NOW });
    expect(effectiveStatus(poll, minutes(-1))).toBe("open");
    expect(effectiveStatus(poll, NOW)).toBe("settled");
  });

  it("lazily settles on time, recording the deadline not the read time", () => {
    const poll = openPoll({ closesAt: minutes(-30) });
    expect(expiredSettlement(poll, NOW)).toEqual({
      status: "settled",
      settledAt: minutes(-30),
      settledEarly: false,
    });
    expect(expiredSettlement(openPoll(), NOW)).toBeNull();
    expect(expiredSettlement(settledPoll(), NOW)).toBeNull();
  });

  it("ends early only while open", () => {
    expect(planEndEarly(openPoll(), NOW)).toEqual({
      status: "settled",
      settledAt: NOW,
      settledEarly: true,
    });
    expectRule(() => planEndEarly(settledPoll(), NOW), "POLL_SETTLED");
    expectRule(
      () => planEndEarly(openPoll({ closesAt: minutes(-1) }), NOW),
      "POLL_SETTLED",
    );
  });

  it("reopens a settled poll with a new future deadline", () => {
    expect(planReopen(settledPoll(), minutes(60), NOW)).toEqual({
      status: "open",
      settledAt: null,
      settledEarly: false,
      closesAt: minutes(60),
    });
  });

  it("reopens a poll whose deadline lapsed but isn't stored as settled yet", () => {
    const lapsed = openPoll({ closesAt: minutes(-5) });
    expect(planReopen(lapsed, minutes(60), NOW).status).toBe("open");
  });

  it("refuses to reopen an open poll or without a future deadline", () => {
    expectRule(() => planReopen(openPoll(), minutes(60), NOW), "POLL_OPEN");
    expectRule(() => planReopen(settledPoll(), NOW, NOW), "DEADLINE_NOT_FUTURE");
    expectRule(
      () => planReopen(settledPoll(), minutes(-1), NOW),
      "DEADLINE_NOT_FUTURE",
    );
  });
});

describe("casting", () => {
  it("accepts a single pick on the ballot, including approved suggestions", () => {
    expect(() => assertCanCast(openPoll(), pizza, ["detroit"], NOW)).not.toThrow();
    expect(() => assertCanCast(openPoll(), pizza, ["pepperoni"], NOW)).not.toThrow();
  });

  it("rejects votes on a settled poll, whatever the stored status says", () => {
    expectRule(() => assertCanCast(settledPoll(), pizza, ["pepperoni"], NOW), "POLL_SETTLED");
    expectRule(
      () => assertCanCast(openPoll({ closesAt: NOW }), pizza, ["pepperoni"], NOW),
      "POLL_SETTLED",
    );
  });

  it("rejects pending and declined suggestions and unknown ids", () => {
    expectRule(() => assertCanCast(openPoll(), pizza, ["salads"], NOW), "OPTION_NOT_ON_BALLOT");
    expectRule(() => assertCanCast(openPoll(), pizza, ["pineapple"], NOW), "OPTION_NOT_ON_BALLOT");
    expectRule(() => assertCanCast(openPoll(), pizza, ["nope"], NOW), "OPTION_NOT_ON_BALLOT");
  });

  it("enforces selection shape", () => {
    expectRule(() => assertCanCast(openPoll(), pizza, [], NOW), "EMPTY_SELECTION");
    expectRule(
      () => assertCanCast(openPoll(), pizza, ["pepperoni", "margherita"], NOW),
      "TOO_MANY_CHOICES",
    );
    const multi = openPoll({ type: "multi", maxChoices: 2 });
    expect(() =>
      assertCanCast(multi, pizza, ["pepperoni", "detroit"], NOW),
    ).not.toThrow();
    expectRule(
      () => assertCanCast(multi, pizza, ["pepperoni", "pepperoni"], NOW),
      "DUPLICATE_CHOICE",
    );
    expectRule(
      () => assertCanCast(multi, pizza, ["pepperoni", "detroit", "margherita"], NOW),
      "TOO_MANY_CHOICES",
    );
  });

  it("treats an identical re-cast as a replay, in any order", () => {
    expect(resolveRecast(["a", "b"], ["b", "a"])).toBe("replay");
  });

  it("rejects any different second cast: no takebacks", () => {
    expectRule(() => resolveRecast(["a"], ["b"]), "ALREADY_VOTED");
    expectRule(() => resolveRecast(["a", "b"], ["a"]), "ALREADY_VOTED");
    expectRule(() => resolveRecast(["a"], ["a", "b"]), "ALREADY_VOTED");
  });
});

describe("suggestions", () => {
  it("accepts a new idea on an open poll with suggestions on", () => {
    expect(() => assertCanSuggest(openPoll(), pizza, "Calzones", NOW)).not.toThrow();
  });

  it("rejects when settled or disabled", () => {
    expectRule(() => assertCanSuggest(settledPoll(), pizza, "Calzones", NOW), "POLL_SETTLED");
    expectRule(
      () => assertCanSuggest(openPoll({ suggestionsEnabled: false }), pizza, "Calzones", NOW),
      "SUGGESTIONS_DISABLED",
    );
  });

  it("rejects duplicates of ballot and pending options, ignoring case and spacing", () => {
    expectRule(() => assertCanSuggest(openPoll(), pizza, "  PEPPERONI ", NOW), "DUPLICATE_LABEL");
    expectRule(() => assertCanSuggest(openPoll(), pizza, "salads", NOW), "DUPLICATE_LABEL");
  });

  it("lets a declined idea be suggested again", () => {
    expect(() => assertCanSuggest(openPoll(), pizza, "Pineapple", NOW)).not.toThrow();
  });
});

describe("moderation", () => {
  const pending = suggestion("salads", "pending");

  it("approves a pending suggestion onto an open ballot", () => {
    expect(planApprove(openPoll(), pizza, pending, NOW)).toEqual({
      suggestionStatus: "approved",
      decidedAt: NOW,
    });
  });

  it("never approves an already-decided suggestion or a creator option", () => {
    expectRule(
      () => planApprove(openPoll(), pizza, suggestion("pineapple", "declined"), NOW),
      "SUGGESTION_NOT_PENDING",
    );
    expectRule(
      () => planApprove(openPoll(), pizza, suggestion("detroit", "approved"), NOW),
      "SUGGESTION_NOT_PENDING",
    );
    expectRule(
      () => planApprove(openPoll(), pizza, creatorOption("pepperoni"), NOW),
      "SUGGESTION_NOT_FOUND",
    );
  });

  it("won't approve onto a settled poll or a full ballot", () => {
    expectRule(() => planApprove(settledPoll(), pizza, pending, NOW), "POLL_SETTLED");
    const full = Array.from({ length: MAX_OPTIONS }, (_, i) => creatorOption(`o${i}`));
    expectRule(() => planApprove(openPoll(), [...full, pending], pending, NOW), "BALLOT_FULL");
  });

  it("declines pending suggestions, even after the poll settles", () => {
    expect(planDecline(pending, NOW)).toEqual({ suggestionStatus: "declined", decidedAt: NOW });
    expectRule(() => planDecline(suggestion("detroit", "approved"), NOW), "SUGGESTION_NOT_PENDING");
  });

  it("undoes a decline inside the window, not after", () => {
    const declined = suggestion("salads", "declined", { decidedAt: NOW });
    const at = (ms: number) => new Date(NOW.getTime() + ms);
    expect(planUndoDecline(declined, at(DECLINE_UNDO_WINDOW_MS))).toEqual({
      suggestionStatus: "pending",
      decidedAt: null,
    });
    expectRule(() => planUndoDecline(declined, at(DECLINE_UNDO_WINDOW_MS + 1)), "UNDO_EXPIRED");
  });

  it("only undoes declines", () => {
    expectRule(() => planUndoDecline(pending, NOW), "SUGGESTION_NOT_DECLINED");
    expectRule(
      () => planUndoDecline(suggestion("detroit", "approved"), NOW),
      "SUGGESTION_NOT_DECLINED",
    );
  });
});
