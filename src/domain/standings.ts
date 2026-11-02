import type { PollStatus, PollType } from "./rules";

// Who's ahead, said honestly. At 7 votes a percentage alone misleads, so
// every claim carries its count, ties are named in words, and an early
// lead with a single vote isn't called a lead at all.

export interface Tally {
  id: string;
  label: string;
  votes: number;
}

export type Standing =
  | { kind: "no-votes" }
  | { kind: "leader"; leader: Tally; aheadBy: number }
  | { kind: "tie"; tied: Tally[] };

/** Ballot options only (creator + approved); order breaks nothing. */
export function computeStanding(tallies: Tally[]): Standing {
  const top = Math.max(0, ...tallies.map((t) => t.votes));
  if (top === 0) return { kind: "no-votes" };

  const leaders = tallies.filter((t) => t.votes === top);
  if (leaders.length > 1) return { kind: "tie", tied: leaders };

  const runnerUp = Math.max(
    0,
    ...tallies.filter((t) => t !== leaders[0]).map((t) => t.votes),
  );
  return { kind: "leader", leader: leaders[0], aheadBy: top - runnerUp };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function listLabels(labels: string[]): string {
  if (labels.length <= 2) return labels.join(" and ");
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/**
 * One line summarising a poll's race, e.g. "Jaws leads · 3 of 7 votes ·
 * ahead by 1". `voters` is the number of ballots: on a multi-choice poll
 * an option's count is out of voters, not out of all picks.
 */
export function describeStanding({
  standing,
  voters,
  type,
  status,
}: {
  standing: Standing;
  voters: number;
  type: PollType;
  status: PollStatus;
}): string {
  const settled = status === "settled";
  const outOf = (votes: number) =>
    type === "multi"
      ? `picked by ${votes} of ${plural(voters, "voter")}`
      : `${votes} of ${plural(voters, "vote")}`;

  switch (standing.kind) {
    case "no-votes":
      return settled ? "Closed with no votes" : "No votes yet";

    case "tie": {
      const each = plural(standing.tied[0].votes, "vote");
      const names = listLabels(standing.tied.map((t) => t.label));
      return settled
        ? `Ended in a tie: ${names}, ${each} each`
        : `Tied: ${names}, ${each} each`;
    }

    case "leader": {
      const { leader, aheadBy } = standing;
      if (settled) return `${leader.label} won · ${outOf(leader.votes)}`;
      // One vote is a first vote, not a lead
      if (voters === 1) return `First vote in: ${leader.label}`;
      return `${leader.label} leads · ${outOf(leader.votes)} · ahead by ${aheadBy}`;
    }
  }
}
