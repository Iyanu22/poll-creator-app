"use client";

import { useSyncExternalStore } from "react";
import { describeDay } from "@/lib/format-time";

const subscribe = () => () => {};

/**
 * "today at 7:00 PM" in the viewer's timezone. The server doesn't know that
 * zone, so it renders a blank and the browser fills it in after hydration
 * (useSyncExternalStore keeps that mismatch-free).
 */
export function LocalDay({ date }: { date: Date }) {
  const onClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <time dateTime={date.toISOString()} className="tabular-nums">
      {onClient ? describeDay(date, new Date()) : " "}
    </time>
  );
}
