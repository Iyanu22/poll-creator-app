// Human deadlines ("today at 7:00 PM", "Saturday at 11:00 AM") in the
// viewer's timezone. Pure: tests pass a fixed locale and timeZone, the
// browser passes neither and gets the user's own.

interface FormatOptions {
  locale?: string;
  timeZone?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar day in the given zone, as a day count, so diffs ignore hours. */
function dayNumber(date: Date, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // "2026-11-01"
  return Date.parse(`${parts}T00:00:00Z`) / DAY_MS;
}

/** "today at 7:00 PM", "yesterday at …", "Saturday at …", "12 Nov at …" */
export function describeDay(
  date: Date,
  now: Date,
  { locale, timeZone }: FormatOptions = {},
): string {
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  const diff = dayNumber(date, timeZone) - dayNumber(now, timeZone);

  let day: string;
  if (diff === 0) day = "today";
  else if (diff === 1) day = "tomorrow";
  else if (diff === -1) day = "yesterday";
  else if (Math.abs(diff) < 7) {
    const weekday = new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: "long",
    }).format(date);
    // A week back, a bare weekday is ambiguous ("Tuesday": which one?)
    day = diff > 0 ? weekday : `last ${weekday}`;
  } else {
    day = new Intl.DateTimeFormat(locale, {
      timeZone,
      day: "numeric",
      month: "short",
    }).format(date);
  }
  return `${day} at ${time}`;
}
