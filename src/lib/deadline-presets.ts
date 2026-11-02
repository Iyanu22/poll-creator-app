// Closing-time quick picks, in the viewer's own timezone (call this in the
// browser). Shared by poll creation and Reopen voting.

export type PresetId = "1h" | "3h" | "tonight" | "tomorrow" | "3days";

export interface DeadlinePreset {
  id: PresetId;
  label: string;
  closesAt: Date;
}

const HOUR_MS = 60 * 60 * 1000;

/** "Tonight" only makes sense with a decent stretch of evening left. */
const TONIGHT_CUTOFF_HOUR = 20;

export function deadlinePresets(
  now: Date,
  ids: readonly PresetId[],
): DeadlinePreset[] {
  const at = (days: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const weekday = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "long" });

  const all: Record<PresetId, () => DeadlinePreset | null> = {
    "1h": () => ({
      id: "1h",
      label: "In 1 hour",
      closesAt: new Date(now.getTime() + HOUR_MS),
    }),
    "3h": () => ({
      id: "3h",
      label: "In 3 hours",
      closesAt: new Date(now.getTime() + 3 * HOUR_MS),
    }),
    tonight: () =>
      now.getHours() < TONIGHT_CUTOFF_HOUR
        ? { id: "tonight", label: "Tonight at 9 PM", closesAt: at(0, 21) }
        : null,
    tomorrow: () => ({
      id: "tomorrow",
      label: "Tomorrow at 7 PM",
      closesAt: at(1, 19),
    }),
    "3days": () => {
      const closesAt = at(3, 19);
      return { id: "3days", label: `${weekday(closesAt)} at 7 PM`, closesAt };
    },
  };
  return ids.flatMap((id) => all[id]() ?? []);
}

/** For <input type="datetime-local">: local wall time, minute precision. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
