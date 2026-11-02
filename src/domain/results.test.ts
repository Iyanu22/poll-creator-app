import { describe, expect, it } from "vitest";
import {
  buildResults,
  announceStanding,
  describeBackers,
  describePackTies,
  describeRace,
  resultSummary,
} from "./results";
import type { Tally } from "./standings";

const t = (label: string, votes: number): Tally => ({
  id: label,
  label,
  votes,
});

const pizza = [
  t("Pepperoni", 3),
  t("Detroit", 5),
  t("Veggie", 2),
  t("Margherita", 1),
];

describe("buildResults", () => {
  it("puts the leader on top and the pack in vote order", () => {
    const r = buildResults(pizza, 11);
    expect(r.top.map((x) => x.option.label)).toEqual(["Detroit"]);
    expect(r.pack.map((x) => x.option.label)).toEqual([
      "Pepperoni",
      "Veggie",
      "Margherita",
    ]);
  });

  it("pairs a share of voters with bars relative to the leader", () => {
    const r = buildResults(pizza, 11);
    expect(r.top[0]).toMatchObject({ percent: 45, barPercent: 100 });
    // 3 votes against a 5-vote leader draws a 60% bar, not 27%
    expect(r.pack[0]).toMatchObject({ percent: 27, barPercent: 60 });
  });

  it("keeps every tied leader on top, in ballot order", () => {
    const r = buildResults([t("Jaws", 1), t("Heat", 2), t("EEAAO", 2)], 5);
    expect(r.standing.kind).toBe("tie");
    expect(r.top.map((x) => x.option.label)).toEqual(["Heat", "EEAAO"]);
    expect(r.pack.map((x) => x.option.label)).toEqual(["Jaws"]);
  });

  it("has no top and no bars before the first vote", () => {
    const r = buildResults([t("A", 0), t("B", 0)], 0);
    expect(r.top).toEqual([]);
    expect(r.pack.map((x) => [x.percent, x.barPercent])).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it("measures multi-choice shares against voters", () => {
    const r = buildResults([t("Lupa", 3), t("Nino's", 3), t("Park", 1)], 4);
    expect(r.top.map((x) => x.percent)).toEqual([75, 75]);
  });
});

describe("describeRace", () => {
  it("keeps the race alive in words", () => {
    const close = buildResults(pizza, 11).standing;
    expect(describeRace(close, 11)).toEqual({
      count: "11 votes in",
      mood: "still anyone's game",
    });
    const clear = buildResults([t("A", 6), t("B", 1)], 7).standing;
    expect(describeRace(clear, 7).mood).toBe("pulling clear");
  });

  it("covers the edges: no votes, one vote, a tie", () => {
    expect(describeRace({ kind: "no-votes" }, 0).count).toBe("No votes yet");
    const one = buildResults([t("A", 1), t("B", 0)], 1).standing;
    expect(describeRace(one, 1)).toEqual({
      count: "1 vote in",
      mood: "too early to call",
    });
    const tie = buildResults([t("A", 2), t("B", 2)], 4).standing;
    expect(describeRace(tie, 4).mood).toBe("dead level at the top");
  });
});

describe("describeBackers", () => {
  it("names up to three, then counts the rest", () => {
    expect(describeBackers(["Priya"])).toBe("Priya backed it");
    expect(describeBackers(["Priya", "Ada"])).toBe("Priya and Ada backed it");
    expect(describeBackers(["Priya", "Ada", "Kai"])).toBe(
      "Priya, Ada and Kai backed it",
    );
    expect(describeBackers(["Priya", "Ada", "Kai", "Noor", "Theo"])).toBe(
      "Priya, Ada, Kai + 2 more backed it",
    );
  });
});

describe("resultSummary", () => {
  it("states the winner, the count and who backed it", () => {
    const results = buildResults(pizza, 11);
    expect(
      resultSummary({
        title: "Pizza night",
        type: "single",
        voters: 11,
        results,
        backers: { Detroit: ["Priya", "Ada", "Kai", "Noor", "Theo"] },
      }),
    ).toBe(
      [
        "Pizza night",
        "Winner: Detroit (5 of 11 votes)",
        "Priya, Ada, Kai + 2 more backed it.",
        "Settled on Tiebreak",
      ].join("\n"),
    );
  });

  it("names a tie instead of picking a winner", () => {
    const results = buildResults([t("Heat", 2), t("Jaws", 2)], 4);
    expect(
      resultSummary({
        title: "Film",
        type: "single",
        voters: 4,
        results,
        backers: {},
      }),
    ).toContain("Ended in a tie: Heat and Jaws, 2 votes each.");
  });
});

describe("describePackTies", () => {
  it("names ties below the leader, ignoring options with no votes", () => {
    const r = buildResults(
      [t("Jaws", 3), t("Heat", 2), t("EEAAO", 2), t("X", 0), t("Y", 0)],
      7,
    );
    expect(describePackTies(r.pack)).toEqual([
      "Heat and EEAAO are tied at 2 votes each.",
    ]);
  });

  it("says nothing when the pack has no ties", () => {
    expect(describePackTies(buildResults(pizza, 11).pack)).toEqual([]);
  });
});

describe("announceStanding", () => {
  it("speaks the race without symbols", () => {
    const { standing } = buildResults(pizza, 11);
    expect(
      announceStanding({
        standing,
        voters: 11,
        type: "single",
        status: "open",
      }),
    ).toBe("11 votes in. Detroit leads, 5 of 11 votes, ahead by 2.");
  });

  it("says when voting has closed", () => {
    const { standing } = buildResults(pizza, 11);
    expect(
      announceStanding({
        standing,
        voters: 11,
        type: "single",
        status: "settled",
      }),
    ).toBe("Voting has closed. Detroit won, 5 of 11 votes.");
  });

  it("handles a poll with no votes", () => {
    expect(
      announceStanding({
        standing: { kind: "no-votes" },
        voters: 0,
        type: "single",
        status: "open",
      }),
    ).toBe("No votes yet.");
  });
});
