import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { Suspense } from "react";
import { POLL_NOT_FOUND_TITLE, getPollMeta } from "@/server/poll-meta";
import { VotePoll } from "./vote-poll";

// Public by link, so the title is too: "Pizza night · Vote · Tiebreak"
export async function generateMetadata({
  params,
}: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meta = await getPollMeta(id);
  if (!meta) return { title: POLL_NOT_FOUND_TITLE };
  return { title: `${meta.title} · ${meta.settled ? "Result" : "Vote"}` };
}

// The public vote page: no account, no nav, one obvious action. Most
// voters see only this screen, on a phone, mid-conversation.
export default function VotePage({ params }: PageProps<"/p/[id]">) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-6 pt-5 outline-none"
    >
      <Logo />
      <Suspense fallback={<VoteSkeleton />}>
        <VotePoll params={params} />
      </Suspense>
    </main>
  );
}

function VoteSkeleton() {
  const block = "rounded-lg bg-cream-deep motion-safe:animate-pulse";
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <span className="sr-only">Loading the poll…</span>
      <div className="flex flex-col gap-4">
        <div className="h-6 w-40 rounded-full bg-cream-deep" />
        <div className="h-10 w-3/4 rounded-full bg-cream-deep" />
      </div>
      <div className={`h-48 ${block}`} />
      <div className={`h-64 ${block}`} />
    </div>
  );
}
