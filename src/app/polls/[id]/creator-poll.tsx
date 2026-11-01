import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { CopyLinkButton } from "@/components/copy-link-button";
import { LivePoll } from "@/components/live-poll";
import { LocalAgo } from "@/components/local-day";
import { Standings, StatusChips, avatarProps } from "@/components/poll-results";
import {
  announceStanding,
  buildResults,
  resultSummary,
} from "@/domain/results";
import {
  getCreatorPoll,
  type BallotOption,
  type CreatorPoll as Poll,
} from "@/server/poll-view";
import { getCurrentUser } from "@/server/session";
import { PendingSuggestions } from "./pending-suggestions";
import { PollControls } from "./poll-controls";

const TITLE_ID = "poll-title";
const STANDINGS_ID = "standings-heading";

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
  const open = poll.status === "open";

  return (
    <>
      <PollHeader poll={poll} />

      <Standings
        poll={poll}
        results={results}
        headingId={STANDINGS_ID}
        emptyState={
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
        }
      />

      <LivePoll
        pollId={poll.id}
        open={open}
        closesAt={poll.closesAt}
        showIndicator
        summary={announceStanding({ ...poll, standing: results.standing })}
      />

      {/* Moderation is for open polls: approving onto a decided ballot
          would change nothing. Reopening brings the queue back. */}
      {open ? (
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
      ) : null}

      <PollControls
        pollId={poll.id}
        status={poll.status}
        titleId={TITLE_ID}
        resultText={
          open
            ? null
            : resultSummary({
                title: poll.title,
                type: poll.type,
                voters: poll.voters,
                results,
                backers: Object.fromEntries(
                  results.top.map((r) => [
                    r.option.id,
                    (poll.backers?.[r.option.id] ?? []).map((p) => p.name),
                  ]),
                ),
              })
        }
      />
    </>
  );
}

function PollHeader({ poll }: { poll: Poll }) {
  return (
    <header className="flex flex-col gap-4">
      <Link href="/polls" className="self-start text-sm font-bold underline">
        <span aria-hidden="true">← </span>My polls
      </Link>
      <StatusChips poll={poll} />
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
