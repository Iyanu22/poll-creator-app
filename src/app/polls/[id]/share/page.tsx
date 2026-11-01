import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { avatarProps } from "@/components/poll-results";
import { getCreatorPoll } from "@/server/poll-view";
import { getCurrentUser } from "@/server/session";
import { ShareCard } from "./share-card";

export const metadata: Metadata = { title: "Share your poll" };

// The moment the product leaves the app and enters the chat. Everything here
// points at one thing: getting the link into the group.
export default function SharePage({ params }: PageProps<"/polls/[id]/share">) {
  return (
    <main className="mx-auto flex w-full max-w-form flex-1 flex-col gap-8 px-6 pt-8 pb-16">
      <Suspense fallback={<ShareSkeleton />}>
        <ShareStep params={params} />
      </Suspense>
    </main>
  );
}

async function ShareStep({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { id } = await params;
  const poll = await getCreatorPoll(id, user.id);
  if (!poll) notFound();

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-extrabold">
          Your poll is ready.
        </h1>
        <p className="font-display text-lg font-bold text-cocoa-soft">
          Now drop it in the chat.
        </p>
      </header>

      <ShareCard pollId={poll.id} title={poll.title} />

      <section
        aria-labelledby="preview-heading"
        className="flex flex-col gap-3"
      >
        <h2
          id="preview-heading"
          className="text-xs font-bold tracking-[0.06em] text-cocoa-soft uppercase"
        >
          What your crew will see
        </h2>
        <ul className="flex flex-col gap-2">
          {poll.ballotOptions.map((option) => (
            <li
              key={option.id}
              className="flex min-h-12 items-center gap-3 rounded-lg border-2 border-cocoa bg-card px-4 py-2"
            >
              <span
                aria-hidden="true"
                className={`size-5 shrink-0 border-2 border-cocoa ${poll.type === "multi" ? "rounded-sm" : "rounded-full"}`}
              />
              <span className="font-display font-bold break-words">
                {option.label}
              </span>
              {option.suggestedBy ? (
                <Avatar {...avatarProps(option.suggestedBy)} size={20} />
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-sm text-cocoa-soft">
          {poll.type === "multi"
            ? `Each voter picks up to ${poll.maxChoices}. `
            : "Each voter picks one. "}
          {poll.suggestionsEnabled
            ? "They can suggest more, and you decide what joins."
            : "Suggestions are off for this one."}
        </p>
      </section>

      <div className="flex flex-col gap-2 border-t-2 border-cream-deep pt-6">
        <p>Votes show up live on your poll, the moment they land.</p>
        <Link
          href={`/polls/${poll.id}`}
          className="self-start font-display text-md font-bold underline"
        >
          Go to your poll <span aria-hidden="true">→</span>
        </Link>
      </div>
    </>
  );
}

function ShareSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div className="h-16 w-3/4 rounded-full bg-cream-deep" />
      <div className="h-48 rounded-lg bg-cream-deep" />
      <div className="h-40 rounded-lg bg-cream-deep" />
    </div>
  );
}
