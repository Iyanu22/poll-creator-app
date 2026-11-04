"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import { POLL_CHANGED, pollChannel, refetchDelay } from "@/lib/realtime";

// Keeps a poll page current without a manual refresh. Pusher says "this poll
// changed" and the page refetches through our server (router.refresh keeps
// client state, focus and scroll). Without Pusher, it polls instead.

type Mode = "connecting" | "live" | "polling";

/** Matches the spec: push under 1s, polling under 5s. */
const POLL_INTERVAL_MS = 5000;
/** A busy poll must not flood a screen reader with per-vote updates. */
const ANNOUNCE_EVERY_MS = 10_000;
/** setTimeout can't wait longer than ~24.8 days. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function LivePoll({
  pollId,
  open,
  closesAt,
  summary,
  showIndicator,
}: {
  pollId: string;
  open: boolean;
  closesAt: Date;
  /** One-sentence state of the race, announced when it changes. */
  summary: string | null;
  showIndicator: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("connecting");
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Coalesce bursts (ten votes in a second) into one refetch, spread out so
  // every open page doesn't refetch on the same tick
  const refresh = useEffectEvent(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(
      () => startTransition(() => router.refresh()),
      refetchDelay(),
    );
  });

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) {
      setMode("polling"); // eslint-disable-line react-hooks/set-state-in-effect -- config is only known client-side
      return;
    }

    let cancelled = false;
    let disconnect = () => {};
    // Loaded on demand so it never weighs on the vote page's first paint
    import("pusher-js")
      .then(({ default: Pusher }) => {
        if (cancelled) return;
        const pusher = new Pusher(key, { cluster });
        disconnect = () => pusher.disconnect();
        pusher
          .subscribe(pollChannel(pollId))
          .bind(POLL_CHANGED, () => refresh());

        let missedEvents = false;
        pusher.connection.bind(
          "state_change",
          ({ previous, current }: { previous: string; current: string }) => {
            // Any drop can lose events, even a blip that goes straight back
            // through "connecting" without ever being "unavailable"
            if (previous === "connected" && current !== "connected") {
              missedEvents = true;
            }
            if (current === "connected") {
              setMode("live");
              // Events sent while we were away are gone: catch up once
              if (missedEvents) refresh();
              missedEvents = false;
            } else if (current === "unavailable" || current === "failed") {
              setMode("polling");
            }
          },
        );
      })
      .catch(() => setMode("polling"));

    return () => {
      cancelled = true;
      disconnect();
    };
  }, [pollId]);

  // A phone that backgrounds the tab (voter switches to the group chat) can
  // sleep through events while the socket still looks connected, so no
  // state change ever fires: catch up whenever the page is shown again
  useEffect(() => {
    const onShown = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onShown);
    return () => document.removeEventListener("visibilitychange", onShown);
  }, []);

  // Fallback: poll while the tab is visible and push isn't working
  useEffect(() => {
    if (mode !== "polling") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [mode]);

  // Nobody writes when a deadline passes (settling is lazy, at read time),
  // so no event fires: refetch just after closing to show the closed state.
  const closesAtMs = closesAt.getTime();
  useEffect(() => {
    if (!open) return;
    const wait = closesAtMs - Date.now() + 1500;
    if (wait > MAX_TIMEOUT_MS) return;
    const timer = setTimeout(() => refresh(), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [open, closesAtMs]);

  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  return (
    <>
      {showIndicator && open ? <Indicator mode={mode} /> : null}
      <ThrottledAnnouncer summary={summary} />
    </>
  );
}

function Indicator({ mode }: { mode: Mode }) {
  const live = mode === "live";
  return (
    <p className="flex items-center gap-2 text-sm text-cocoa-soft">
      <span aria-hidden="true" className="relative flex size-3">
        {live ? (
          <span className="absolute inset-0 rounded-full bg-teal motion-safe:animate-ping" />
        ) : null}
        <span
          className={`relative size-3 rounded-full border-2 border-teal-deep ${live ? "bg-teal" : "bg-cream-bright"}`}
        />
      </span>
      {live
        ? "Live: updates as votes land"
        : mode === "polling"
          ? "Checking for new votes every few seconds"
          : "Connecting to live updates…"}
    </p>
  );
}

/**
 * The page's one polite live region for the race. Says nothing on load,
 * then at most one summary per ANNOUNCE_EVERY_MS, always the latest.
 */
function ThrottledAnnouncer({ summary }: { summary: string | null }) {
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef({ text: summary, at: 0 });
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!summary || summary === announced.current.text) return;
    clearTimeout(pending.current);
    const announce = () => {
      announced.current = { text: summary, at: Date.now() };
      setAnnouncement(summary);
    };
    const wait = announced.current.at + ANNOUNCE_EVERY_MS - Date.now();
    if (wait <= 0) announce();
    else pending.current = setTimeout(announce, wait);
    return () => clearTimeout(pending.current);
  }, [summary]);

  return (
    <p aria-live="polite" className="sr-only">
      {announcement}
    </p>
  );
}
