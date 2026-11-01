"use client";

import { useEffect, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

/** Copies the absolute URL for `path` and announces the result. */
export function CopyLinkButton({
  path,
  className,
}: {
  path: string;
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
      await navigator.clipboard.writeText(
        new URL(path, window.location.origin).href,
      );
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <button type="button" onClick={copy} className={className}>
        {state === "idle" ? "Copy link" : null}
        {state === "copied" ? "Copied" : null}
        {state === "failed" ? "Couldn't copy" : null}
      </button>
      {/* Present from first render so screen readers pick up the change */}
      <span role="status" className="sr-only">
        {state === "copied" ? "Link copied" : null}
        {state === "failed" ? "Couldn't copy the link" : null}
      </span>
    </>
  );
}
