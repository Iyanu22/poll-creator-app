import { describe, expect, it } from "vitest";
import { validateDraft, type PollDraft } from "./poll-draft";

const now = new Date("2026-11-02T12:00:00Z");
const draft = (overrides: Partial<PollDraft> = {}): PollDraft => ({
  title: "Pizza night: what are we ordering?",
  options: ["Detroit-style", "Pepperoni"],
  type: "single",
  maxChoices: 1,
  suggestionsEnabled: true,
  closesAt: new Date("2026-11-02T19:00:00Z"),
  ...overrides,
});

describe("validateDraft", () => {
  it("accepts a minimal poll and tidies the text", () => {
    const result = validateDraft(
      draft({
        title: "  Pizza   tonight? ",
        options: [" Detroit ", "", "Veggie"],
      }),
      now,
    );
    expect(result).toEqual({
      ok: true,
      poll: expect.objectContaining({
        title: "Pizza tonight?",
        options: ["Detroit", "Veggie"],
        maxChoices: 1,
      }),
    });
  });

  it("asks for a question and at least two options", () => {
    const result = validateDraft(
      draft({ title: " ", options: ["Only one", ""] }),
      now,
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toMatchObject({
      title: "Give your poll a question.",
      options: "Add at least 2 options.",
    });
  });

  it("flags duplicates on the later field, ignoring case and spacing", () => {
    const result = validateDraft(
      draft({ options: ["Jaws", "Heat", "  jaws "] }),
      now,
    );
    expect(!result.ok && result.errors.optionFields).toEqual({
      2: "That's already an option.",
    });
  });

  it("caps the ballot at ten options", () => {
    const options = Array.from({ length: 11 }, (_, i) => `Option ${i + 1}`);
    const result = validateDraft(draft({ options }), now);
    expect(!result.ok && result.errors.options).toBe(
      "10 options is the most a poll can have.",
    );
  });

  it("keeps pick-up-to-N within the options", () => {
    const tooMany = validateDraft(draft({ type: "multi", maxChoices: 3 }), now);
    expect(!tooMany.ok && tooMany.errors.maxChoices).toBe(
      "There are only 2 options to pick from.",
    );
    const one = validateDraft(draft({ type: "multi", maxChoices: 1 }), now);
    expect(!one.ok && one.errors.maxChoices).toBeDefined();
    const ok = validateDraft(
      draft({ type: "multi", maxChoices: 2, options: ["A", "B", "C"] }),
      now,
    );
    expect(ok.ok && ok.poll.maxChoices).toBe(2);
  });

  it("forces single-choice polls to one pick", () => {
    const result = validateDraft(draft({ type: "single", maxChoices: 4 }), now);
    expect(result.ok && result.poll.maxChoices).toBe(1);
  });

  it("needs a closing time in the future", () => {
    const past = validateDraft(
      draft({ closesAt: new Date("2026-11-02T11:59:00Z") }),
      now,
    );
    expect(!past.ok && past.errors.closesAt).toBe(
      "Pick a closing time in the future.",
    );
    const missing = validateDraft(draft({ closesAt: new Date("nope") }), now);
    expect(!missing.ok && missing.errors.closesAt).toBe(
      "Pick when voting closes.",
    );
  });
});
