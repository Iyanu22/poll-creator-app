import { notFound } from "next/navigation";
import { Avatar, faceUri } from "@/components/avatar";
import { LivePoll } from "@/components/live-poll";
import { Standings, StatusChips, avatarProps } from "@/components/poll-results";
import { announceStanding, buildResults, type Results } from "@/domain/results";
import { VOTER_FACES } from "@/domain/rules";
import { getPublicPoll, type PublicPoll } from "@/server/public-poll";
import type { BallotOption } from "@/server/poll-view";
import { readVoterToken } from "@/server/voter-token";
import { JustVotedHeading } from "./just-voted";
import { SuggestDialog } from "./suggest-dialog";
import { VoteForm } from "./vote-form";

const STANDINGS_ID = "standings-heading";

function listLabels(labels: string[]) {
  return labels.length <= 2
    ? labels.join(" and ")
    : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

// Three states share one URL, and each says which it is up front, right
// under the title: the ballot, "you're in", or "voting's closed".
export async function VotePoll({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const poll = await getPublicPoll(id, await readVoterToken());
  if (!poll) notFound();

  const results = buildResults<BallotOption>(poll.ballotOptions, poll.voters);
  const myLabels = poll.myBallot
    ? poll.ballotOptions
        .filter((o) => poll.myBallot!.optionIds.includes(o.id))
        .map((o) => o.label)
    : [];

  return (
    <>
      <header className="flex flex-col gap-4">
        <StatusChips poll={poll} />
        <p className="font-bold text-cocoa-soft">
          {poll.creatorFirstName}&apos;s asking
        </p>
        <h1 className="font-display text-xl font-extrabold break-words sm:text-2xl">
          {poll.title}
        </h1>
      </header>

      {poll.status === "settled" ? (
        <ClosedView poll={poll} results={results} myLabels={myLabels} />
      ) : poll.myBallot ? (
        <VotedView poll={poll} results={results} myLabels={myLabels} />
      ) : (
        <VoteForm
          pollId={poll.id}
          type={poll.type}
          maxChoices={poll.maxChoices}
          creatorFirstName={poll.creatorFirstName}
          suggestionsEnabled={poll.suggestionsEnabled}
          faces={VOTER_FACES.map((seed) => ({ seed, src: faceUri(seed) }))}
          choices={poll.ballotOptions.map((o) => ({
            id: o.id,
            label: o.label,
            suggestedByName: o.suggestedBy?.name ?? null,
            suggestedByAvatar: o.suggestedBy ? (
              <Avatar {...avatarProps(o.suggestedBy)} size={22} />
            ) : null,
          }))}
        />
      )}

      {/* Keeps every state current: the race once it's visible, quietly
          otherwise (a suggestion joins the ballot, the deadline passes) */}
      <LivePoll
        pollId={poll.id}
        open={poll.status === "open"}
        closesAt={poll.closesAt}
        showIndicator={poll.canSeeCounts}
        summary={
          poll.canSeeCounts
            ? announceStanding({ ...poll, standing: results.standing })
            : null
        }
      />
    </>
  );
}

/** Already voted, poll still open: their choice, then the race in counts. */
function VotedView({
  poll,
  results,
  myLabels,
}: {
  poll: PublicPoll;
  results: Results<BallotOption>;
  myLabels: string[];
}) {
  const me = poll.myBallot!;
  return (
    <>
      <section className="flex items-center gap-4 rounded-lg border-[length:var(--border-card)] border-cocoa bg-teal-soft p-5">
        <Avatar {...avatarProps(me)} size={64} />
        <div className="flex flex-col gap-1">
          <JustVotedHeading pollId={poll.id}>
            You&apos;re in, {me.name}.
          </JustVotedHeading>
          <p>
            You backed <strong>{listLabels(myLabels)}</strong>. No takebacks:
            your vote is locked in.
          </p>
        </div>
      </section>

      <Standings poll={poll} results={results} headingId={STANDINGS_ID} />

      {poll.suggestionsEnabled ? (
        <SuggestDialog
          pollId={poll.id}
          creatorFirstName={poll.creatorFirstName}
          identity={{
            name: me.name,
            // Ballots only ever carry preset faces for real voters
            avatarSeed: me.avatarSeed as (typeof VOTER_FACES)[number],
            avatarTint: me.avatarTint,
          }}
        />
      ) : null}
    </>
  );
}

/** Settled: the result for everyone, with their own pick if they had one. */
function ClosedView({
  poll,
  results,
  myLabels,
}: {
  poll: PublicPoll;
  results: Results<BallotOption>;
  myLabels: string[];
}) {
  const { standing, top } = results;
  const headline =
    standing.kind === "no-votes"
      ? "Voting's closed, and nobody voted."
      : standing.kind === "tie"
        ? `Voting's closed: it ended in a tie between ${listLabels(top.map((r) => r.option.label))}.`
        : `Voting's closed: the crew picked ${top[0].option.label}.`;

  return (
    <>
      <section className="flex flex-col gap-2 rounded-lg border-[length:var(--border-card)] border-cocoa bg-cream-deep p-5">
        <h2 className="font-display text-lg font-extrabold">{headline}</h2>
        {myLabels.length ? (
          <p>
            You backed <strong>{listLabels(myLabels)}</strong>.
          </p>
        ) : null}
      </section>
      <Standings poll={poll} results={results} headingId={STANDINGS_ID} />
    </>
  );
}
