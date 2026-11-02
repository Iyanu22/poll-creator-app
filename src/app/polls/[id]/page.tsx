import type { Metadata } from "next";
import { Suspense } from "react";
import { POLL_NOT_FOUND_TITLE, getPollMeta } from "@/server/poll-meta";
import { getCurrentUser } from "@/server/session";
import { CreatorPoll } from "./creator-poll";

// "Pizza night · Live results · Tiebreak". Only the creator sees the title:
// to anyone else this poll doesn't exist, in the tab as on the page.
export async function generateMetadata({
  params,
}: PageProps<"/polls/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [meta, user] = await Promise.all([getPollMeta(id), getCurrentUser()]);
  if (!meta || meta.creatorId !== user?.id) {
    return { title: POLL_NOT_FOUND_TITLE };
  }
  return {
    title: `${meta.title} · ${meta.settled ? "Result" : "Live results"}`,
  };
}

export default function PollPage({ params }: PageProps<"/polls/[id]">) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-6 pt-4 pb-16 outline-none"
    >
      <Suspense fallback={<PollSkeleton />}>
        <CreatorPoll params={params} />
      </Suspense>
    </main>
  );
}

/** Header, leader card and pack, sized like the real thing. */
function PollSkeleton() {
  const block = "rounded-lg bg-cream-deep motion-safe:animate-pulse";
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <span className="sr-only">Loading your poll…</span>
      <div className="flex flex-col gap-4">
        <div className="h-4 w-20 rounded-full bg-cream-deep" />
        <div className="h-7 w-56 rounded-full bg-cream-deep" />
        <div className={`h-24 ${block}`} />
      </div>
      <div className={`h-60 ${block}`} />
      <div className={`h-52 ${block}`} />
    </div>
  );
}
