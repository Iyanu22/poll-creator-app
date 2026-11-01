"use client";

import { useEffect } from "react";
import { revealStorageKey } from "@/lib/reveal";

// The reveal plays the first time this device sees a result, then never
// again (until the poll is reopened and settles anew: the key includes the
// settle time). Two paths set [data-reveal]:
// - first page load: an inline script before first paint (no flash of the
//   finished card before the animation starts): see lib/reveal
// - the poll settles while the page is open: this effect, after a live
//   refresh mounts the card (inserted scripts never run)

export function RevealOnce({
  elementId,
  revealKey,
}: {
  elementId: string;
  revealKey: string;
}) {
  useEffect(() => {
    const el = document.getElementById(elementId);
    if (!el || el.hasAttribute("data-reveal")) return;
    try {
      const key = revealStorageKey(revealKey);
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return; // no storage, no replay tracking: show it settled
    }
    el.setAttribute("data-reveal", "");
  }, [elementId, revealKey]);

  return null;
}
