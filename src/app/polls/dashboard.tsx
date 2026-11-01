import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyLinkButton } from "@/components/copy-link-button";
import { LocalDay } from "@/components/local-day";
import { describeStanding } from "@/domain/standings";
import { getDashboard, type DashboardPoll } from "@/server/dashboard";
import { getCurrentUser } from "@/server/session";

// Reads the session, so it renders inside <Suspense> (see page.tsx).
export async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { featured, open, settled } = await getDashboard(user.id);

  if (!featured && settled.length === 0) {
    // Placeholder until the first-run experience is designed
    return (
      <p className="text-cocoa-soft">
        No polls yet.{" "}
        <Link href="/polls/new" className="font-bold text-cocoa underline">
          Make your first one
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {featured ? (
        <section aria-labelledby="featured-heading">
          <SectionHeading id="featured-heading">Closes soonest</SectionHeading>
          <FeaturedPoll poll={featured} />
        </section>
      ) : null}

      {open.length > 0 ? (
        <section aria-labelledby="open-heading">
          <SectionHeading id="open-heading" count={open.length}>
            Also open
          </SectionHeading>
          <PollList polls={open} />
        </section>
      ) : null}

      {settled.length > 0 ? (
        <section aria-labelledby="settled-heading">
          <SectionHeading id="settled-heading" count={settled.length}>
            Settled
          </SectionHeading>
          <PollList polls={settled} />
        </section>
      ) : null}
    </div>
  );
}

function SectionHeading({
  id,
  count,
  children,
}: {
  id: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="mb-3 text-xs font-bold tracking-[0.06em] text-cocoa-soft uppercase"
    >
      {children}
      {count !== undefined ? (
        <span className="tabular-nums"> · {count}</span>
      ) : null}
    </h2>
  );
}

function FeaturedPoll({ poll }: { poll: DashboardPoll }) {
  return (
    <article className="relative flex flex-col gap-4 rounded-lg border-[length:var(--border-card)] border-cocoa bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={poll.status} />
        <span className="rounded-full border-[length:var(--border-chip)] border-cocoa px-3 py-1 text-xs font-bold">
          Closes <LocalDay date={poll.closesAt} />
        </span>
      </div>
      <h3 className="font-display text-xl font-extrabold">
        <PollLink poll={poll} />
      </h3>
      <p className="text-md tabular-nums">{describeStanding(poll)}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PendingSuggestions count={poll.pendingSuggestions} />
        {/* Above the stretched title link so it stays clickable */}
        <div className="relative z-10 ml-auto">
          <CopyLinkButton
            path={`/p/${poll.id}`}
            className="rounded-full bg-cocoa px-5 py-2.5 font-display text-base font-bold text-cream-bright shadow-press-cocoa"
          />
        </div>
      </div>
    </article>
  );
}

function PollList({ polls }: { polls: DashboardPoll[] }) {
  // Settled polls sit on the canvas instead of a card: filed away, not live
  const surface = polls[0]?.status === "settled" ? "bg-cream" : "bg-card";
  return (
    <ul
      className={`divide-y-[length:var(--border-divider)] divide-dashed divide-cream-deep rounded-lg border-[length:var(--border-card)] border-cocoa ${surface}`}
    >
      {polls.map((poll) => (
        <li key={poll.id} className="relative flex flex-col gap-1.5 px-6 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-display text-md font-bold">
              <PollLink poll={poll} />
            </h3>
            <PollTiming poll={poll} />
          </div>
          <p className="text-sm text-cocoa-soft tabular-nums">
            {describeStanding(poll)}
          </p>
          <PendingSuggestions count={poll.pendingSuggestions} />
        </li>
      ))}
    </ul>
  );
}

/** The title link stretches over its card, so the whole card is clickable. */
function PollLink({ poll }: { poll: DashboardPoll }) {
  return (
    <Link
      href={`/polls/${poll.id}`}
      className="after:absolute after:inset-0 after:rounded-[inherit] hover:underline"
    >
      {poll.title}
    </Link>
  );
}

function PollTiming({ poll }: { poll: DashboardPoll }) {
  if (poll.status === "open") {
    return (
      <span className="text-xs font-bold whitespace-nowrap">
        Closes <LocalDay date={poll.closesAt} />
      </span>
    );
  }
  return (
    <span className="text-xs whitespace-nowrap text-cocoa-soft">
      {poll.settledEarly ? "Ended early " : "Closed "}
      <LocalDay date={poll.settledAt!} />
    </span>
  );
}

function StatusChip({ status }: { status: DashboardPoll["status"] }) {
  return status === "open" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-3 py-1 text-xs font-bold text-teal-deep">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-teal-deep" />
      Voting open
    </span>
  ) : (
    <span className="rounded-full bg-cream-deep px-3 py-1 text-xs font-bold">
      Settled
    </span>
  );
}

function PendingSuggestions({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p className="self-start rounded-full border-[length:var(--border-chip)] border-cocoa px-3 py-1 text-xs font-bold tabular-nums">
      {count} {count === 1 ? "suggestion" : "suggestions"} waiting for you
    </p>
  );
}
