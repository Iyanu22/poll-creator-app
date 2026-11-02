"use client";

import { useEffect, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

/**
 * Copies text and announces the outcome through its own status region,
 * without moving focus.
 */
function CopyButton({
  getText,
  label,
  announcement,
  className,
}: {
  getText: () => string;
  label: string;
  /** e.g. "Link copied" */
  announcement: string;
  className?: string;
}) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(getText());
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <button type="button" onClick={copy} className={className}>
        {state === "idle" ? label : null}
        {state === "copied" ? "Copied" : null}
        {state === "failed" ? "Couldn't copy" : null}
      </button>
      {/* Present from first render so screen readers pick up the change */}
      <span role="status" className="sr-only">
        {state === "copied" ? announcement : null}
        {state === "failed" ? "Couldn't copy. Try again." : null}
      </span>
    </>
  );
}

/** Copies the absolute URL for `path`. */
export function CopyLinkButton({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  return (
    <CopyButton
      getText={() => new URL(path, window.location.origin).href}
      label="Copy link"
      announcement="Link copied"
      className={className}
    />
  );
}

/** Copies the outcome as text for the group chat. */
export function CopyResultButton({
  text,
  path,
  className,
}: {
  text: string;
  /** The poll, linked on the last line so the paste stands on its own. */
  path: string;
  className?: string;
}) {
  return (
    <CopyButton
      getText={() => `${text}\n${new URL(path, window.location.origin).href}`}
      label="Copy result"
      announcement="Result copied"
      className={className}
    />
  );
}
