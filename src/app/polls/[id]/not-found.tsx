import Link from "next/link";

// Missing, deleted, or someone else's: deliberately indistinguishable.
export default function CreatorPollNotFound() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-content flex-1 flex-col items-start gap-4 px-6 py-14 outline-none"
    >
      <h1 className="font-display text-2xl font-extrabold">
        We couldn&apos;t find that poll.
      </h1>
      <p className="max-w-prose text-md text-cocoa-soft">
        It may have been deleted, or it belongs to a different account.
      </p>
      <Link href="/polls" className="font-display text-md font-bold underline">
        Back to my polls
      </Link>
    </main>
  );
}
