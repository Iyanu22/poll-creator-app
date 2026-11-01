import { Avatar } from "@/components/avatar";
import {
  TALLY_TICK_LIMIT,
  describeBackers,
  describePackTies,
  describeRace,
  type ResultRow,
  type Results,
} from "@/domain/results";
import type { PollStatus, PollType } from "@/domain/rules";
import type { BallotOption, Person } from "@/server/poll-view";
import { LocalDay } from "./local-day";

// The results story shared by the creator page and the public vote page:
// leader (or tie), the pack, the race in words. Follows the brand kit data-viz
// rules: counts beside every percentage, bars relative to the leader, ties
// in words. Backers are only ever passed in once a poll has settled.

/** What the results views need to know about a poll. */
export interface ResultsPoll {
  status: PollStatus;
  type: PollType;
  maxChoices: number;
  voters: number;
  closesAt: Date;
  settledAt: Date | null;
  settledEarly: boolean;
  backers: Record<string, Person[]> | null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function avatarProps(person: Person) {
  return {
    seed: person.avatarSeed,
    tint: person.avatarTint,
    name: person.name,
  };
}

/**
 * Leader, pack and race line under one heading. The heading is focusable so
 * callers can send focus here when something they removed had it.
 */
export function Standings({
  poll,
  results,
  headingId,
  emptyState,
}: {
  poll: ResultsPoll;
  results: Results<BallotOption>;
  headingId: string;
  /** Shown under "No votes yet" while the poll is open. */
  emptyState?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} tabIndex={-1} className="sr-only">
        Standings
      </h2>
      <TopCard poll={poll} results={results} emptyState={emptyState} />
      <Pack poll={poll} rows={results.pack} />
      <RaceLine poll={poll} results={results} />
    </section>
  );
}

const chip = "rounded-full px-3 py-1 text-xs font-bold";
const outlinedChip = `${chip} border-[length:var(--border-chip)] border-cocoa bg-card`;

/** Status in words plus color, the deadline, and the pick-up-to-N rule. */
export function StatusChips({ poll }: { poll: ResultsPoll }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {poll.status === "open" ? (
        <>
          <span
            className={`${chip} inline-flex items-center gap-1.5 bg-teal-soft text-teal-deep`}
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-teal-deep"
            />
            Voting open
          </span>
          <span className={outlinedChip}>
            Closes <LocalDay date={poll.closesAt} />
          </span>
        </>
      ) : (
        <>
          <span className={`${chip} bg-cream-deep`}>Settled</span>
          <span className={outlinedChip}>
            {poll.settledEarly ? "Ended early " : "Closed "}
            <LocalDay date={poll.settledAt!} />
          </span>
        </>
      )}
      {poll.type === "multi" ? (
        <span className={outlinedChip}>Pick up to {poll.maxChoices}</span>
      ) : null}
    </div>
  );
}

// ── The leader (or the tie, or the empty state) ──────────────────────────

function TopCard({
  poll,
  results,
  emptyState,
}: {
  poll: ResultsPoll;
  results: Results<BallotOption>;
  emptyState?: React.ReactNode;
}) {
  const settled = poll.status === "settled";
  const { standing, top } = results;

  if (standing.kind === "no-votes") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border-[length:var(--border-card)] border-dashed border-cocoa bg-card p-6">
        <h3 className="font-display text-lg font-extrabold">
          {settled ? "This one closed without a vote" : "No votes yet"}
        </h3>
        {settled ? null : emptyState}
      </div>
    );
  }

  const ribbon =
    standing.kind === "tie"
      ? settled
        ? "Ended in a tie"
        : "Tied at the top"
      : settled
        ? "Winner"
        : poll.voters === 1
          ? "First vote"
          : "In the lead";

  return (
    <article
      aria-labelledby="top-heading"
      className="relative flex flex-col gap-4 overflow-hidden rounded-lg border-[length:var(--border-card)] border-cocoa bg-tangerine p-6 text-cream-bright"
    >
      <Ribbon>{ribbon}</Ribbon>
      {standing.kind === "tie" ? (
        <TieBody poll={poll} rows={top} />
      ) : (
        <LeaderBody poll={poll} row={top[0]} aheadBy={standing.aheadBy} />
      )}
    </article>
  );
}

function Ribbon({ children }: { children: React.ReactNode }) {
  return (
    <p className="absolute top-0 right-0 rounded-bl-lg border-b-[length:var(--border-chip)] border-l-[length:var(--border-chip)] border-cocoa bg-butter px-4 py-1.5 text-xs font-bold tracking-[0.06em] text-cocoa uppercase">
      {children}
    </p>
  );
}

const scrimPill =
  "rounded-full bg-scrim-on-tangerine px-3 py-1.5 text-sm font-bold tabular-nums";

function LeaderBody({
  poll,
  row,
  aheadBy,
}: {
  poll: ResultsPoll;
  row: ResultRow<BallotOption>;
  aheadBy: number;
}) {
  const { option, percent } = row;
  const settled = poll.status === "settled";
  const firstVote = !settled && poll.voters === 1;
  const count =
    poll.type === "multi"
      ? `picked by ${option.votes} of ${plural(poll.voters, "voter")}`
      : `${option.votes} of ${plural(poll.voters, "vote")}`;

  return (
    <>
      <div className="flex flex-col items-start gap-3 pt-6 sm:pt-0 sm:pr-40">
        <h3
          id="top-heading"
          className="font-display text-xl font-extrabold break-words"
        >
          {option.label}
        </h3>
        {option.suggestedBy ? (
          <SuggestedBy person={option.suggestedBy} className={scrimPill} />
        ) : null}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        {firstVote ? (
          <p className="font-display text-lg font-extrabold">
            First vote&apos;s in. Too early to call.
          </p>
        ) : (
          <p className="leading-num font-display text-num font-extrabold tabular-nums">
            {percent}
            <span className="text-lg">%</span>
          </p>
        )}
        <p className={scrimPill}>
          {count}
          {!settled && !firstVote ? ` · ahead by ${aheadBy}` : null}
        </p>
      </div>
      <TallyTicks filled={option.votes} total={poll.voters} />
      {settled ? <Backers people={poll.backers?.[option.id] ?? []} /> : null}
    </>
  );
}

function TieBody({
  poll,
  rows,
}: {
  poll: ResultsPoll;
  rows: ResultRow<BallotOption>[];
}) {
  const votes = rows[0].option.votes;
  return (
    <>
      <h3
        id="top-heading"
        className="pt-6 font-display text-xl font-extrabold sm:pt-0 sm:pr-40"
      >
        Tied at {plural(votes, "vote")} each
      </h3>
      <ul className="flex flex-col gap-3">
        {rows.map(({ option }) => (
          <li key={option.id} className="flex flex-col items-start gap-2">
            <span className="font-display text-lg font-bold break-words">
              {option.label}
            </span>
            {option.suggestedBy ? (
              <SuggestedBy person={option.suggestedBy} className={scrimPill} />
            ) : null}
            {poll.status === "settled" ? (
              <Backers people={poll.backers?.[option.id] ?? []} />
            ) : null}
          </li>
        ))}
      </ul>
      <p className={`${scrimPill} self-start`}>
        {plural(votes, "vote")} each, out of {plural(poll.voters, "vote")}
      </p>
    </>
  );
}

/**
 * One tick per voter, filled ticks for the leader's votes: 5 of 11 reads as
 * 5 of 11, not as a landslide. Past TALLY_TICK_LIMIT voters ticks turn to
 * noise, so it becomes a share bar. Decorative: the numbers are in text.
 */
function TallyTicks({ filled, total }: { filled: number; total: number }) {
  if (total > TALLY_TICK_LIMIT) {
    return (
      <div aria-hidden="true" className="h-3 rounded-full bg-tangerine-deep">
        <div
          className="h-full rounded-full bg-butter"
          style={{ width: `${(filled / total) * 100}%` }}
        />
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-3 flex-1 rounded-sm ${i < filled ? "bg-butter" : "bg-tangerine-deep"}`}
        />
      ))}
    </div>
  );
}

export function Backers({ people }: { people: Person[] }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, 5);
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {shown.map((person, i) => (
          <Avatar
            key={`${person.name}-${i}`}
            {...avatarProps(person)}
            size={32}
          />
        ))}
      </div>
      <p className="text-sm font-bold">
        {describeBackers(people.map((p) => p.name))}
      </p>
    </div>
  );
}

export function SuggestedBy({
  person,
  className = "",
}: {
  person: Person;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Avatar {...avatarProps(person)} size={22} />
      Suggested by {person.name}
    </span>
  );
}

// ── The rest of the pack ─────────────────────────────────────────────────

function Pack({
  poll,
  rows,
}: {
  poll: ResultsPoll;
  rows: ResultRow<BallotOption>[];
}) {
  if (rows.length === 0) return null;
  const ties = describePackTies(rows);
  return (
    <>
      <ul className="divide-y-[length:var(--border-divider)] divide-dashed divide-cream-deep rounded-lg border-[length:var(--border-card)] border-cocoa bg-card">
        {rows.map(({ option, percent, barPercent }) => (
          <li
            key={option.id}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-6 py-4 sm:grid-cols-[1fr_12rem_7.5rem]"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-display text-md font-bold break-words">
                {option.label}
              </span>
              {option.suggestedBy ? (
                <SuggestedBy
                  person={option.suggestedBy}
                  className="text-xs text-cocoa-soft"
                />
              ) : null}
            </div>
            {/* Relative to the leader: answers "how far behind?" */}
            <div
              aria-hidden="true"
              className="col-span-2 row-start-2 h-2.5 rounded-full bg-cream-deep sm:col-span-1 sm:row-start-auto"
            >
              <div
                className="h-full rounded-full bg-teal"
                style={{ width: `${barPercent}%` }}
              />
            </div>
            <p className="text-right whitespace-nowrap tabular-nums">
              {poll.voters > 0 ? (
                <span className="font-display text-lg font-extrabold">
                  {percent}%
                </span>
              ) : null}{" "}
              <span className="text-xs text-cocoa-soft">
                {plural(option.votes, "vote")}
              </span>
            </p>
          </li>
        ))}
      </ul>
      {ties.map((line) => (
        <p key={line} className="px-2 text-sm font-bold">
          {line}
        </p>
      ))}
    </>
  );
}

function RaceLine({ poll, results }: { poll: ResultsPoll; results: Results }) {
  if (poll.status === "settled" || poll.voters === 0) return null;
  const { count, mood } = describeRace(results.standing, poll.voters);
  return (
    <p className="px-2 font-display text-md font-bold tabular-nums">
      {count} <span aria-hidden="true">—</span>
      <span className="sr-only">,</span>{" "}
      <span className="text-tangerine-deep">{mood}</span>
    </p>
  );
}
