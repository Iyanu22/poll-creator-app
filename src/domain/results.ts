import type { PollStatus, PollType } from "./rules";
import {
  computeStanding,
  describeStanding,
  type Standing,
  type Tally,
} from "./standings";

// The numbers behind the results screen. Everything here follows the brand
// kit's data-viz rules: percentages always ride with counts, trailing bars
// are relative to the leader, and ties are a state rather than a sort order.

/** Past this many voters, one tick per voter stops reading as a scoreboard. */
export const TALLY_TICK_LIMIT = 20;

export interface ResultRow<T extends Tally = Tally> {
  option: T;
  /** Share of voters who picked it (multi-choice shares can sum past 100). */
  percent: number;
  /** Bar width relative to the leader, 0–100. */
  barPercent: number;
}

export interface Results<T extends Tally = Tally> {
  standing: Standing;
  /** The leader, or every tied leader. Empty when nobody has voted. */
  top: ResultRow<T>[];
  /** Everyone else, most votes first; ballot order breaks equal counts. */
  pack: ResultRow<T>[];
}

export function buildResults<T extends Tally>(
  ballotOptions: T[],
  voters: number,
): Results<T> {
  const standing = computeStanding(ballotOptions);
  const leaderVotes = Math.max(0, ...ballotOptions.map((o) => o.votes));

  const rows = ballotOptions
    .map((option, index) => ({
      index,
      row: {
        option,
        percent: voters ? Math.round((option.votes / voters) * 100) : 0,
        barPercent: leaderVotes
          ? Math.round((option.votes / leaderVotes) * 100)
          : 0,
      },
    }))
    .sort(
      (a, b) => b.row.option.votes - a.row.option.votes || a.index - b.index,
    )
    .map(({ row }) => row);

  if (standing.kind === "no-votes") return { standing, top: [], pack: rows };
  const topCount = standing.kind === "tie" ? standing.tied.length : 1;
  return { standing, top: rows.slice(0, topCount), pack: rows.slice(topCount) };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "11 votes in" plus how the race feels, said like a friend keeping score. */
export function describeRace(
  standing: Standing,
  voters: number,
): {
  count: string;
  mood: string;
} {
  const count = `${plural(voters, "vote")} in`;
  switch (standing.kind) {
    case "no-votes":
      return { count: "No votes yet", mood: "share the link to get it going" };
    case "tie":
      return { count, mood: "dead level at the top" };
    case "leader":
      if (voters === 1) return { count, mood: "too early to call" };
      // A lead worth under a quarter of the votes cast can flip quickly
      return standing.aheadBy / voters < 0.25
        ? { count, mood: "still anyone's game" }
        : { count, mood: "pulling clear" };
  }
}

function listNames(names: string[], max = 3): string {
  if (names.length <= max) {
    return names.length <= 2
      ? names.join(" and ")
      : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  }
  return `${names.slice(0, max).join(", ")} + ${names.length - max} more`;
}

/** "Priya, Ada, Kai + 2 more backed it" */
export function describeBackers(names: string[]): string {
  if (names.length === 0) return "Nobody backed it";
  return `${listNames(names)} backed it`;
}

/**
 * The Copy result payload: the outcome as text for the group chat, distinct
 * from Copy link's bare URL.
 */
export function resultSummary({
  title,
  type,
  voters,
  results,
  backers,
}: {
  title: string;
  type: PollType;
  voters: number;
  results: Results;
  /** Backer names per winning option id. */
  backers: Record<string, string[]>;
}): string {
  const outOf = (votes: number) =>
    type === "multi"
      ? `picked by ${votes} of ${plural(voters, "voter")}`
      : `${votes} of ${plural(voters, "vote")}`;
  const lines = [title];

  const { standing, top } = results;
  if (standing.kind === "no-votes") {
    lines.push("Closed with no votes.");
  } else if (standing.kind === "tie") {
    const each = plural(top[0].option.votes, "vote");
    lines.push(
      `Ended in a tie: ${listNames(
        top.map((r) => r.option.label),
        top.length,
      )}, ${each} each.`,
    );
  } else {
    const winner = top[0].option;
    lines.push(`Winner: ${winner.label} (${outOf(winner.votes)})`);
    const names = backers[winner.id] ?? [];
    if (names.length) lines.push(`${describeBackers(names)}.`);
  }
  lines.push("Settled on Tiebreak");
  return lines.join("\n");
}

/**
 * Ties further down the pack, in words: equal bars alone don't say it.
 * e.g. "Heat and Everything Everywhere All at Once are tied at 2 votes each."
 */
export function describePackTies(pack: ResultRow[]): string[] {
  const groups = new Map<number, string[]>();
  for (const { option } of pack) {
    if (option.votes === 0) continue;
    groups.set(option.votes, [
      ...(groups.get(option.votes) ?? []),
      option.label,
    ]);
  }
  return [...groups]
    .filter(([, labels]) => labels.length > 1)
    .map(
      ([votes, labels]) =>
        `${listNames(labels, labels.length)} are tied at ${plural(votes, "vote")} each.`,
    );
}

/**
 * The race as one sentence for the live region, e.g. "12 votes in. Detroit
 * leads, 5 of 12 votes, ahead by 2." Spoken, so no middots.
 */
export function announceStanding({
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
  const line = describeStanding({ standing, voters, type, status }).replaceAll(
    " · ",
    ", ",
  );
  if (status === "settled") return `Voting has closed. ${line}.`;
  if (standing.kind === "no-votes") return `${line}.`;
  return `${describeRace(standing, voters).count}. ${line}.`;
}
