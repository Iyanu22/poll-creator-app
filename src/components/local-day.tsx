"use client";

import { useSyncExternalStore } from "react";
import { describeAgo, describeDay } from "@/lib/format-time";

const subscribe = () => () => {};

/**
 * Times in the viewer's timezone. The server doesn't know that zone, so it
 * renders a blank and the browser fills it in after hydration
 * (useSyncExternalStore keeps that mismatch-free).
 */
function LocalTime({
  date,
  format,
}: {
  date: Date;
  format: (date: Date, now: Date) => string;
}) {
  const onClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <time dateTime={date.toISOString()} className="tabular-nums">
      {onClient ? format(date, new Date()) : " "}
    </time>
  );
}

/** "today at 7:00 PM" */
export function LocalDay({ date }: { date: Date }) {
  return <LocalTime date={date} format={describeDay} />;
}

/** "2 min ago" */
export function LocalAgo({ date }: { date: Date }) {
  return <LocalTime date={date} format={describeAgo} />;
}
