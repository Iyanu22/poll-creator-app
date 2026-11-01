import type { Metadata } from "next";
import { Suspense } from "react";
import { CreatorPoll } from "./creator-poll";

export const metadata: Metadata = { title: "Your poll" };

export default function PollPage({ params }: PageProps<"/polls/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-6 pt-4 pb-16">
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
