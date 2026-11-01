import { describe, expect, it } from "vitest";
import { computeStanding, describeStanding, type Tally } from "./standings";

const t = (label: string, votes: number): Tally => ({
  id: label,
  label,
  votes,
});

function describe1(
  tallies: Tally[],
  voters: number,
  opts: { type?: "single" | "multi"; status?: "open" | "settled" } = {},
) {
  return describeStanding({
    standing: computeStanding(tallies),
    voters,
    type: opts.type ?? "single",
    status: opts.status ?? "open",
  });
}

describe("computeStanding", () => {
  it("reports no votes when everything is at zero", () => {
    expect(computeStanding([t("A", 0), t("B", 0)])).toEqual({
      kind: "no-votes",
    });
    expect(computeStanding([])).toEqual({ kind: "no-votes" });
  });

  it("finds the leader and the margin over the runner-up", () => {
    const s = computeStanding([
      t("Pepperoni", 3),
      t("Detroit", 5),
      t("Veggie", 2),
    ]);
    expect(s).toMatchObject({
      kind: "leader",
      leader: { label: "Detroit" },
      aheadBy: 2,
    });
  });

  it("never lets order crown a winner in a tie", () => {
    const s = computeStanding([t("Heat", 2), t("Jaws", 2), t("EEAAO", 1)]);
    expect(s).toMatchObject({ kind: "tie" });
    expect(s.kind === "tie" && s.tied.map((x) => x.label)).toEqual([
      "Heat",
      "Jaws",
    ]);
  });
});

describe("describeStanding", () => {
  it("pairs every lead with its count", () => {
    expect(describe1([t("Detroit", 5), t("Pepperoni", 3)], 11)).toBe(
      "Detroit leads · 5 of 11 votes · ahead by 2",
    );
  });

  it("does not call a single vote a lead", () => {
    expect(describe1([t("Jaws", 1), t("Heat", 0)], 1)).toBe(
      "First vote in: Jaws",
    );
  });

  it("states ties in words", () => {
    expect(describe1([t("Heat", 2), t("Jaws", 2)], 4)).toBe(
      "Tied: Heat and Jaws, 2 votes each",
    );
    expect(describe1([t("A", 1), t("B", 1), t("C", 1)], 3)).toBe(
      "Tied: A, B and C, 1 vote each",
    );
  });

  it("speaks in the past tense once settled", () => {
    expect(
      describe1([t("Thursday", 4), t("Friday", 3)], 9, { status: "settled" }),
    ).toBe("Thursday won · 4 of 9 votes");
    expect(describe1([t("A", 2), t("B", 2)], 4, { status: "settled" })).toBe(
      "Ended in a tie: A and B, 2 votes each",
    );
    expect(describe1([t("A", 0)], 0, { status: "settled" })).toBe(
      "Closed with no votes",
    );
  });

  it("counts multi-choice picks out of voters, not out of picks", () => {
    expect(
      describe1([t("Lupa", 3), t("Nino's", 2)], 4, { type: "multi" }),
    ).toBe("Lupa leads · picked by 3 of 4 voters · ahead by 1");
  });

  it("handles the zero-votes poll", () => {
    expect(describe1([t("A", 0), t("B", 0)], 0)).toBe("No votes yet");
  });
});
