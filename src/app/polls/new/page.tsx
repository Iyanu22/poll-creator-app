import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/server/session";
import { PollForm } from "./poll-form";

export const metadata: Metadata = { title: "New poll" };

export default function NewPollPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-form flex-1 flex-col gap-8 px-6 pt-4 pb-16 outline-none"
    >
      <header className="flex flex-col gap-4">
        <Link href="/polls" className="self-start text-sm font-bold underline">
          <span aria-hidden="true">← </span>My polls
        </Link>
        <h1 className="font-display text-xl font-extrabold">New poll</h1>
        <p className="text-cocoa-soft">
          A question, a few options, a deadline. Under a minute, then you share
          the link.
        </p>
      </header>
      {/* The form reads ?title= (carried over from the empty dashboard) and
          the session, both request-time, so it streams in */}
      <Suspense fallback={<FormSkeleton />}>
        <SignedInForm />
      </Suspense>
    </main>
  );
}

async function SignedInForm() {
  if (!(await getCurrentUser())) redirect("/sign-in");
  return <PollForm />;
}

function FormSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading the form…</span>
      <div className="h-20 rounded-md bg-cream-deep" />
      <div className="h-40 rounded-md bg-cream-deep" />
      <div className="h-56 rounded-md bg-cream-deep" />
    </div>
  );
}
