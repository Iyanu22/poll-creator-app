import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { CopyLinkButton } from "@/components/copy-link-button";
import { LocalAgo, LocalDay } from "@/components/local-day";
import {
  TALLY_TICK_LIMIT,
  buildResults,
  describeBackers,
  describePackTies,
  describeRace,
  resultSummary,
  type ResultRow,
  type Results,
} from "@/domain/results";
import {
  getCreatorPoll,
  type BallotOption,
  type CreatorPoll as Poll,
  type Person,
} from "@/server/poll-view";
import { getCurrentUser } from "@/server/session";
import { PendingSuggestions } from "./pending-suggestions";
import { PollControls } from "./poll-controls";

const TITLE_ID = "poll-title";
const STANDINGS_ID = "standings-heading";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// One story, top to bottom: status, title, leader, the pack, then the
// creator's controls. Reads the session, so it renders inside <Suspense>.
export async function CreatorPoll({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { id } = await params;
  const poll = await getCreatorPoll(id, user.id);
  if (!poll) notFound();

  const results = buildResults<BallotOption>(poll.ballotOptions, poll.voters);
  const settled = poll.status === "settled";
  const backerNames = (optionId: string) =>
    (poll.backers?.[optionId] ?? []).map((p) => p.name);

  return (
    <>
      <PollHeader poll={poll} />

      <section aria-labelledby={STANDINGS_ID} className="flex flex-col gap-4">
        <h2 id={STANDINGS_ID} tabIndex={-1} className="sr-only">
          Standings
        </h2>
        <TopCard poll={poll} results={results} />
        <Pack poll={poll} rows={results.pack} />
        <RaceLine poll={poll} results={results} />
      </section>

      <PendingSuggestions
        pollId={poll.id}
        fallbackFocusId={STANDINGS_ID}
        pending={poll.pending.map((s) => ({
          id: s.id,
          label: s.label,
          authorName: s.suggestedBy.name,
          avatar: <Avatar {...avatarProps(s.suggestedBy)} size={48} />,
        }))}
      />

      <PollControls
        pollId={poll.id}
        status={poll.status}
        titleId={TITLE_ID}
        resultText={
          settled
            ? resultSummary({
                title: poll.title,
                type: poll.type,
                voters: poll.voters,
                results,
                backers: Object.fromEntries(
                  results.top.map((r) => [
                    r.option.id,
                    backerNames(r.option.id),
                  ]),
                ),
              })
            : null
        }
      />
    </>
  );
}

function avatarProps(person: Person) {
  return {
    seed: person.avatarSeed,
    tint: person.avatarTint,
    name: person.name,
  };
}

// ── Header ───────────────────────────────────────────────────────────────

function PollHeader({ poll }: { poll: Poll }) {
  const chip = "rounded-full px-3 py-1 text-xs font-bold";
  return (
    <header className="flex flex-col gap-4">
      <Link href="/polls" className="self-start text-sm font-bold underline">
        <span aria-hidden="true">← </span>My polls
      </Link>
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
            <span
              className={`${chip} border-[length:var(--border-chip)] border-cocoa bg-card`}
            >
              Closes <LocalDay date={poll.closesAt} />
            </span>
          </>
        ) : (
          <>
            <span className={`${chip} bg-cream-deep`}>Settled</span>
            <span
              className={`${chip} border-[length:var(--border-chip)] border-cocoa bg-card`}
            >
              {poll.settledEarly ? "Ended early " : "Closed "}
              <LocalDay date={poll.settledAt!} />
            </span>
          </>
        )}
        {poll.type === "multi" ? (
          <span
            className={`${chip} border-[length:var(--border-chip)] border-cocoa bg-card`}
          >
            Pick up to {poll.maxChoices}
          </span>
        ) : null}
      </div>
      {/* Focus target after End voting / Reopen, when the button vanishes */}
      <h1
        id={TITLE_ID}
        tabIndex={-1}
        className="font-display text-xl font-extrabold break-words sm:text-2xl"
      >
        {poll.title}
      </h1>
      <p className="text-sm text-cocoa-soft tabular-nums">
        {poll.voters === 0 ? (
          "Nobody's voted yet"
        ) : (
          <>
            <strong className="text-cocoa">{poll.voters} of your crew</strong>{" "}
            voted
            {poll.lastCastAt ? (
              <>
                {" "}
                · last one <LocalAgo date={poll.lastCastAt} />
              </>
            ) : null}
          </>
        )}
      </p>
    </header>
  );
}

// ── The leader (or the tie, or the empty state) ──────────────────────────

function TopCard({
  poll,
  results,
}: {
  poll: Poll;
  results: Results<BallotOption>;
}) {
  const settled = poll.status === "settled";
  const { standing, top } = results;

  if (standing.kind === "no-votes") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border-[length:var(--border-card)] border-dashed border-cocoa bg-card p-6">
        <h3 className="font-display text-lg font-extrabold">
          {settled ? "This one closed without a vote" : "No votes yet"}
        </h3>
        {settled ? null : (
          <>
            <p className="text-cocoa-soft">
              Your link works: the first vote will show up here the moment it
              lands.
            </p>
            <CopyLinkButton
              path={`/p/${poll.id}`}
              className="min-h-11 rounded-full border-2 border-cocoa px-5 font-display text-base font-bold"
            />
          </>
        )}
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
  poll: Poll;
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
  poll: Poll;
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

function Backers({ people }: { people: Person[] }) {
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

function SuggestedBy({
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

function Pack({ poll, rows }: { poll: Poll; rows: ResultRow<BallotOption>[] }) {
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

function RaceLine({ poll, results }: { poll: Poll; results: Results }) {
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
