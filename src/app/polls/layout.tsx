import Link from "next/link";
import { Suspense } from "react";
import { AccountStatus } from "../account-status";

// Creator-side chrome. Static except the account corner, which reads the
// session behind its own boundary so the header never waits on it.
export default function PollsLayout({ children }: LayoutProps<"/polls">) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-4 px-6 py-5">
        <nav aria-label="Main" className="flex items-center gap-6">
          <Link href="/polls" className="font-display text-lg font-extrabold">
            tiebreak
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/polls/new"
            className="rounded-full border-2 border-cocoa px-4 py-2 font-display text-sm font-bold"
          >
            <span aria-hidden="true">+ </span>New poll
          </Link>
          <Suspense fallback={null}>
            <AccountStatus />
          </Suspense>
        </div>
      </header>
      {children}
    </>
  );
}
