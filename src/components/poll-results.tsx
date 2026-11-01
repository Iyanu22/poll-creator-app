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
import { revealScript } from "@/lib/reveal";
import { RevealOnce } from "./reveal-once";

// The results story shared by the creator page and the public vote page:
// leader (or tie), the pack, the race in words. Follows the brand kit data-viz
// rules: counts beside every percentage, bars relative to the leader, ties
// in words. Backers are only ever passed in once a poll has settled.

/** What the results views need to know about a poll. */
export interface ResultsPoll {
  id: string;
  title: string;
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
  tieSlot,
}: {
  poll: ResultsPoll;
  results: Results<BallotOption>;
  headingId: string;
  /** Shown under "No votes yet" while the poll is open. */
  emptyState?: React.ReactNode;
  /** What happens next when a poll settles tied (action or note). */
  tieSlot?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} tabIndex={-1} className="sr-only">
        Standings
      </h2>
      <TopCard
        poll={poll}
        results={results}
        emptyState={emptyState}
        tieSlot={tieSlot}
      />
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
  tieSlot,
}: {
  poll: ResultsPoll;
  results: Results<BallotOption>;
  emptyState?: React.ReactNode;
  tieSlot?: React.ReactNode;
}) {
  const settled = poll.status === "settled";
  const { standing, top } = results;

  if (settled && standing.kind !== "no-votes") {
    return <ResultCard poll={poll} results={results} tieSlot={tieSlot} />;
  }

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

  // Live from here on: settled polls get the ResultCard above
  const ribbon =
    standing.kind === "tie"
      ? "Tied at the top"
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
  const firstVote = poll.voters === 1;
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
          {firstVote ? null : ` · ahead by ${aheadBy}`}
        </p>
      </div>
      <TallyTicks filled={option.votes} total={poll.voters} />
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
          className="reveal-bar h-full rounded-full bg-butter"
          style={{ width: `${(filled / total) * 100}%` }}
        />
      </div>
    );
  }
  // At the reveal, the winner's ticks light up one by one (--i staggers them)
  return (
    <div aria-hidden="true" className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={i < filled ? ({ "--i": i } as React.CSSProperties) : undefined}
          className={`h-3 flex-1 rounded-sm ${i < filled ? "reveal-tick bg-butter" : "bg-tangerine-deep"}`}
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

// ── The reveal: the settled result as one self-contained card ────────────

/** Butter sparks around the winner's name, as offsets from its corner. */
const BURST = [
  { dx: "-2.5rem", dy: "-1.75rem" },
  { dx: "1rem", dy: "-2.5rem" },
  { dx: "3.5rem", dy: "-1.5rem" },
  { dx: "-3rem", dy: "0.75rem" },
  { dx: "4.5rem", dy: "0.5rem" },
  { dx: "0.5rem", dy: "2rem" },
];

/**
 * Everything a screenshot needs in one card: the question, the result, the
 * count, who backed it, when it settled. Tangerine and butter at their
 * loudest, and a once-per-device count-up (see reveal-once). A tie is
 * unfinished business, with tieSlot saying what happens next.
 */
function ResultCard({
  poll,
  results,
  tieSlot,
}: {
  poll: ResultsPoll;
  results: Results<BallotOption>;
  tieSlot?: React.ReactNode;
}) {
  const { standing, top } = results;
  const tie = standing.kind === "tie";
  const winnerVotes = top[0].option.votes;
  // The name lands just after the last tick lights (capped for big polls)
  const lit = poll.voters > TALLY_TICK_LIMIT ? 10 : Math.min(winnerVotes, 20);
  const stampAt = `${tie ? 200 : 300 + lit * 90}ms`;
  const elementId = `result-${poll.id}`;
  const revealKey = `${poll.id}:${poll.settledAt?.getTime()}`;

  return (
    <>
      <article
        id={elementId}
        aria-labelledby="top-heading"
        style={{ "--stamp-at": stampAt } as React.CSSProperties}
        // The pre-paint script may add data-reveal before hydration
        suppressHydrationWarning
        className="relative flex flex-col gap-5 overflow-hidden rounded-lg border-[length:var(--border-card)] border-cocoa bg-tangerine p-6 text-cream-bright sm:p-8"
      >
        <p className="reveal-ribbon absolute top-0 right-0 rounded-bl-lg border-b-[length:var(--border-chip)] border-l-[length:var(--border-chip)] border-cocoa bg-butter px-4 py-1.5 text-xs font-bold tracking-[0.06em] text-cocoa uppercase">
          {tie ? "It's a tie" : "Winner"}
        </p>

        {/* Repeats the page title so a cropped screenshot still makes sense;
            hidden from screen readers, which already have the h1 */}
        <p
          aria-hidden="true"
          className="pt-6 pr-2 font-display text-lg font-extrabold break-words sm:pt-0 sm:pr-32"
        >
          {poll.title}
        </p>

        {tie ? (
          <TieResult poll={poll} rows={top} tieSlot={tieSlot} />
        ) : (
          <WinnerResult poll={poll} row={top[0]} />
        )}

        <p className="reveal-after self-start rounded-full bg-scrim-on-tangerine px-3 py-1.5 text-xs font-bold">
          {poll.settledEarly ? "Ended early " : "Settled "}
          <LocalDay date={poll.settledAt!} /> ·{" "}
          <span className="font-display">tiebreak</span>
        </p>
      </article>
      <script
        dangerouslySetInnerHTML={{ __html: revealScript(elementId, revealKey) }}
      />
      <RevealOnce elementId={elementId} revealKey={revealKey} />
    </>
  );
}

function WinnerResult({
  poll,
  row,
}: {
  poll: ResultsPoll;
  row: ResultRow<BallotOption>;
}) {
  const { option, percent } = row;
  const count =
    poll.type === "multi"
      ? `picked by ${option.votes} of ${plural(poll.voters, "voter")}`
      : `${option.votes} of ${plural(poll.voters, "vote")}`;
  return (
    <>
      <div className="relative flex flex-col items-start gap-3">
        <h3
          id="top-heading"
          className="reveal-stamp font-display text-2xl font-extrabold break-words"
        >
          {option.label}
        </h3>
        <span aria-hidden="true">
          {BURST.map((spark, i) => (
            <span
              key={i}
              style={
                { "--dx": spark.dx, "--dy": spark.dy } as React.CSSProperties
              }
              className="reveal-burst absolute top-2 left-8 size-3 rotate-45 rounded-sm bg-butter"
            />
          ))}
        </span>
        {option.suggestedBy ? (
          <SuggestedBy
            person={option.suggestedBy}
            className={`reveal-after ${scrimPill}`}
          />
        ) : null}
      </div>
      <div className="reveal-after flex flex-wrap items-end justify-between gap-3">
        <p className="leading-num font-display text-num font-extrabold tabular-nums">
          {percent}
          <span className="text-lg">%</span>
        </p>
        <p className={scrimPill}>{count}</p>
      </div>
      <TallyTicks filled={option.votes} total={poll.voters} />
      {/* Small text on tangerine needs the scrim to reach AA (brand kit) */}
      <div className="reveal-after self-start rounded-full bg-scrim-on-tangerine py-1 pr-4 pl-1">
        <Backers people={poll.backers?.[option.id] ?? []} />
      </div>
    </>
  );
}

function TieResult({
  poll,
  rows,
  tieSlot,
}: {
  poll: ResultsPoll;
  rows: ResultRow<BallotOption>[];
  tieSlot?: React.ReactNode;
}) {
  const votes = rows[0].option.votes;
  return (
    <>
      <h3
        id="top-heading"
        className="reveal-stamp font-display text-2xl font-extrabold"
      >
        Tied at {plural(votes, "vote")} each
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ option }, i) => (
          <li
            key={option.id}
            style={
              { "--stamp-at": `${300 + i * 150}ms` } as React.CSSProperties
            }
            className="reveal-stamp flex flex-col items-start gap-3 rounded-md border-2 border-cocoa bg-scrim-on-tangerine p-4"
          >
            <span className="font-display text-lg font-extrabold break-words">
              {option.label}
            </span>
            <Backers people={poll.backers?.[option.id] ?? []} />
          </li>
        ))}
      </ul>
      <p className="reveal-after self-start rounded-md bg-scrim-on-tangerine px-3 py-1.5 text-sm font-bold">
        {plural(votes, "vote")} each, out of {plural(poll.voters, "vote")}. The
        crew needs a tiebreaker.
      </p>
      {tieSlot ? <div className="reveal-after">{tieSlot}</div> : null}
    </>
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
