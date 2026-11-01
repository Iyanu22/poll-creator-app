import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/server/session";
import { GuestButton } from "./guest-button";

// The front door: what Tiebreak is, shown rather than told (a sample result
// leads), and two ways in. No testimonials, logos or press: there aren't
// any, and inventing them would be the opposite of honest results.

const primary =
  "inline-flex min-h-14 items-center justify-center rounded-full bg-cocoa px-7 font-display text-md font-bold text-cream-bright shadow-press-cocoa aria-disabled:opacity-60";
const secondary =
  "inline-flex min-h-14 items-center justify-center rounded-full border-2 border-cocoa px-7 font-display text-md font-bold";

export default function Home() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-page items-center justify-between gap-4 px-6 py-5">
        <Logo />
        <Suspense
          fallback={
            <Link href="/sign-in" className="font-bold underline">
              Sign in
            </Link>
          }
        >
          <HeaderLink />
        </Suspense>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-page flex-1 flex-col gap-20 px-6 pt-8 pb-20 outline-none"
      >
        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-6">
            <h1 className="font-display text-2xl font-extrabold sm:text-[4rem] sm:leading-[1.02]">
              Settle it in the group chat.
            </h1>
            <p className="max-w-xl text-md text-cocoa-soft">
              Make a poll in under a minute, drop the link in the chat, and
              watch your crew decide. No accounts for voters, honest live
              results, and a reveal worth screenshotting.
            </p>
            {/* Signed-out is the common case, so it's also the fallback */}
            <Suspense fallback={<SignedOutActions />}>
              <Actions />
            </Suspense>
          </div>
          <SampleResult />
        </section>

        <section aria-labelledby="how-heading" className="flex flex-col gap-6">
          <h2
            id="how-heading"
            className="text-xs font-bold tracking-[0.06em] text-cocoa-soft uppercase"
          >
            How it works
          </h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-full border-2 border-cocoa bg-butter font-display text-md font-extrabold"
                >
                  {i + 1}
                </span>
                <h3 className="font-display text-lg font-extrabold">
                  {step.title}
                </h3>
                <p className="text-cocoa-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-page px-6 pb-8 text-sm text-cocoa-soft">
        Tiebreak, built for Frontend Mentor&apos;s poll creator product
        challenge.
      </footer>
    </>
  );
}

const STEPS = [
  { title: "Ask", body: "A question, a few options, a deadline." },
  {
    title: "Share the link",
    body: "Friends vote from their phones. A name, a face, done.",
  },
  {
    title: "Watch it settle",
    body: "Live counts, ties called out in words, then the reveal.",
  },
];

async function HeaderLink() {
  const user = await getCurrentUser();
  return user ? (
    <Link href="/polls" className="font-bold underline">
      My polls
    </Link>
  ) : (
    <Link href="/sign-in" className="font-bold underline">
      Sign in
    </Link>
  );
}

async function Actions() {
  const user = await getCurrentUser();
  if (!user) return <SignedOutActions />;
  return (
    <div className="flex flex-wrap items-start gap-3">
      <Link href="/polls" className={primary}>
        Go to your polls <span aria-hidden="true">&nbsp;→</span>
      </Link>
    </div>
  );
}

function SignedOutActions() {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <GuestButton className={primary} />
      <Link href="/sign-in" className={secondary}>
        Sign in
      </Link>
    </div>
  );
}

const SAMPLE_BACKERS = [
  { seed: "Priya", tint: "f8c9b9", name: "Priya" },
  { seed: "Ada", tint: "f6e0a4", name: "Ada" },
  { seed: "Kai", tint: "e3d2f2", name: "Kai" },
] as const;

/**
 * The product's payoff as the hero visual: a settled result card, labelled
 * as a sample. data-reveal is set statically, so the count-up plays on each
 * visit here (reduced motion shows it finished).
 */
function SampleResult() {
  return (
    <figure
      data-reveal=""
      style={{ "--stamp-at": "750ms" } as React.CSSProperties}
      className="relative flex flex-col gap-5 overflow-hidden rounded-lg border-[length:var(--border-card)] border-cocoa bg-tangerine p-7 text-cream-bright"
    >
      <figcaption className="self-start rounded-full bg-cream-bright px-3 py-1 text-xs font-bold text-cocoa">
        Sample result
      </figcaption>
      <p className="reveal-ribbon absolute top-0 right-0 rounded-bl-lg border-b-[length:var(--border-chip)] border-l-[length:var(--border-chip)] border-cocoa bg-butter px-4 py-1.5 text-xs font-bold tracking-[0.06em] text-cocoa uppercase">
        Winner
      </p>
      <p className="font-display text-lg font-extrabold">
        Pizza night: what are we ordering?
      </p>
      <p className="reveal-stamp font-display text-xl font-extrabold">
        Detroit-style from Emmy&apos;s
      </p>
      <div className="reveal-after flex flex-wrap items-end justify-between gap-3">
        <p className="leading-num font-display text-num font-extrabold tabular-nums">
          45<span className="text-lg">%</span>
        </p>
        <p className="rounded-full bg-scrim-on-tangerine px-3 py-1.5 text-sm font-bold tabular-nums">
          5 of 11 votes
        </p>
      </div>
      <div aria-hidden="true" className="flex gap-1.5">
        {Array.from({ length: 11 }, (_, i) => (
          <span
            key={i}
            style={i < 5 ? ({ "--i": i } as React.CSSProperties) : undefined}
            className={`h-3 flex-1 rounded-sm ${i < 5 ? "reveal-tick bg-butter" : "bg-tangerine-deep"}`}
          />
        ))}
      </div>
      <div className="reveal-after flex items-center gap-3 self-start rounded-full bg-scrim-on-tangerine py-1 pr-4 pl-1">
        <div className="flex -space-x-2">
          {SAMPLE_BACKERS.map((p) => (
            <Avatar key={p.name} seed={p.seed} tint={p.tint} name={p.name} />
          ))}
        </div>
        <p className="text-sm font-bold">Priya, Ada, Kai + 2 more backed it</p>
      </div>
    </figure>
  );
}
