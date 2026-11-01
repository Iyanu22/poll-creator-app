import type { Metadata } from "next";
import Link from "next/link";
import { Logo, LogoMark } from "@/components/logo";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-content flex-1 flex-col gap-10 px-6 py-6 outline-none"
    >
      <Logo />
      <div className="flex flex-col items-start gap-4 py-10">
        <LogoMark size={56} />
        <h1 className="font-display text-2xl font-extrabold">Nothing here.</h1>
        <p className="max-w-prose text-md text-cocoa-soft">
          This page doesn&apos;t exist. If someone sent you a poll link, it may
          have been cut off in the chat: ask them to send it again.
        </p>
        <Link href="/" className="font-display text-md font-bold underline">
          Go to Tiebreak
        </Link>
      </div>
    </main>
  );
}
