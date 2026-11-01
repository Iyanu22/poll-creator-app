"use client";

import { useEffect, useRef } from "react";
import { justVotedKey } from "./identity";

/**
 * The confirmation heading. Right after casting it takes focus (the form
 * that had it is gone) and plays its stamp-in once; on a later visit it's
 * just a heading.
 */
export function JustVotedHeading({
  pollId,
  children,
}: {
  pollId: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const key = justVotedKey(pollId);
    if (sessionStorage.getItem(key) !== "1") return;
    sessionStorage.removeItem(key);
    ref.current?.focus();
    ref.current?.setAttribute("data-just-voted", "");
  }, [pollId]);

  return (
    <h2
      ref={ref}
      tabIndex={-1}
      className="font-display text-xl font-extrabold data-just-voted:motion-safe:animate-[stamp-in_400ms_ease-out]"
    >
      {children}
    </h2>
  );
}
