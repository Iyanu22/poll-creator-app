import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "My polls" };

export default function PollsPage() {
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-6 py-10">
      <h1 className="font-display text-xl font-extrabold">My polls</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

/** Roughly the featured card + one list, so the real data doesn't jump. */
function DashboardSkeleton() {
  const block = "rounded-lg bg-cream-deep motion-safe:animate-pulse";
  return (
    <div aria-busy="true" className="flex flex-col gap-10">
      <span className="sr-only">Loading your polls…</span>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-32 rounded-full bg-cream-deep" />
        <div className={`h-56 ${block}`} />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-24 rounded-full bg-cream-deep" />
        <div className={`h-44 ${block}`} />
      </div>
    </div>
  );
}
