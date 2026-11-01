"use client";

import { useState, useSyncExternalStore } from "react";
import { CopyLinkButton } from "@/components/copy-link-button";

const subscribe = () => () => {};

/**
 * The link and the two ways out of the app: the phone's own share sheet
 * (straight into WhatsApp, iMessage…) where the browser has one, and Copy
 * link everywhere.
 */
export function ShareCard({
  pollId,
  title,
}: {
  pollId: string;
  title: string;
}) {
  const path = `/p/${pollId}`;
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
  const canShare = useSyncExternalStore(
    subscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const [shareFailed, setShareFailed] = useState(false);
  const url = `${origin}${path}`;

  async function share() {
    setShareFailed(false);
    try {
      await navigator.share({ title, text: `Vote: ${title}`, url });
    } catch (error) {
      // Closing the share sheet isn't a failure
      if ((error as Error).name !== "AbortError") setShareFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border-[length:var(--border-card)] border-cocoa bg-card p-6">
      <p className="font-display text-lg font-extrabold break-words">{title}</p>
      {/* Long links truncate; the buttons are the real affordance */}
      <p className="truncate rounded-md bg-cream-deep px-3 py-2 font-bold">
        {origin.replace(/^https?:\/\//, "")}
        {path}
      </p>
      <div className="flex flex-wrap gap-3">
        {canShare ? (
          <button
            type="button"
            onClick={share}
            className="min-h-12 rounded-full bg-cocoa px-6 font-display text-md font-bold text-cream-bright shadow-press-cocoa"
          >
            Share…
          </button>
        ) : null}
        <CopyLinkButton
          path={path}
          className={
            canShare
              ? "min-h-12 rounded-full border-2 border-cocoa px-6 font-display text-md font-bold"
              : "min-h-12 rounded-full bg-cocoa px-6 font-display text-md font-bold text-cream-bright shadow-press-cocoa"
          }
        />
      </div>
      {shareFailed ? (
        <p role="alert" className="text-sm">
          Sharing didn&apos;t work here. Copy the link instead.
        </p>
      ) : null}
    </div>
  );
}
