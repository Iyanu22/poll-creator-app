"use client";

import { useState, useTransition } from "react";
import { runTiebreakerAction } from "./actions";

/** The creator's way out of a tie: a fresh poll of just the tied options. */
export function TiebreakerButton({ pollId }: { pollId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => {
          if (isPending) return;
          setError(null);
          startTransition(async () => {
            // Redirects to the new poll's share step on success
            const result = await runTiebreakerAction(pollId);
            if (!result.ok) setError(result.message);
          });
        }}
        aria-disabled={isPending}
        aria-busy={isPending}
        className="min-h-12 rounded-full border-2 border-cocoa bg-cream-bright px-6 font-display text-md font-bold text-cocoa aria-disabled:opacity-60"
      >
        {isPending ? "Setting it up…" : "Run a tiebreaker"}
      </button>
      <p className="rounded-md bg-scrim-on-tangerine px-3 py-1.5 text-sm font-bold">
        A one-hour re-vote with just the tied options.
      </p>
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-cream-bright px-3 py-2 text-sm text-cocoa"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
