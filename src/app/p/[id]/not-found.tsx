// A voter followed a link to a poll that isn't there: deleted, or the link
// lost a few characters on its way through the chat. Say what probably
// happened and what to do, without selling them anything.
import { Logo } from "@/components/logo";

// It replaces the whole page, so it brings its own landmark and logo.
export default function PollNotFound() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-6 pt-5 outline-none"
    >
      <Logo />
      <div className="flex flex-col items-start gap-4 py-10">
        <h1 className="font-display text-2xl font-extrabold">
          This poll isn&apos;t here.
        </h1>
        <p className="max-w-prose text-md text-cocoa-soft">
          It may have been deleted, or the link got cut off somewhere along the
          way. Ask whoever sent it for a fresh link.
        </p>
      </div>
    </main>
  );
}
