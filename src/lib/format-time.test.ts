import { describe, expect, it } from "vitest";
import { describeDay } from "./format-time";

const opts = { locale: "en-US", timeZone: "Europe/London" };
// Sunday 1 Nov 2026, 15:00 in London (GMT)
const now = new Date("2026-11-01T15:00:00Z");

describe("describeDay", () => {
  it("names today, tomorrow and yesterday", () => {
    expect(describeDay(new Date("2026-11-01T19:00:00Z"), now, opts)).toBe(
      "today at 7:00 PM",
    );
    expect(describeDay(new Date("2026-11-02T20:00:00Z"), now, opts)).toBe(
      "tomorrow at 8:00 PM",
    );
    expect(describeDay(new Date("2026-10-31T09:30:00Z"), now, opts)).toBe(
      "yesterday at 9:30 AM",
    );
  });

  it("uses the weekday within a week, marking past ones", () => {
    expect(describeDay(new Date("2026-11-07T11:00:00Z"), now, opts)).toBe(
      "Saturday at 11:00 AM",
    );
    expect(describeDay(new Date("2026-10-27T17:30:00Z"), now, opts)).toBe(
      "last Tuesday at 5:30 PM",
    );
  });

  it("falls back to a date beyond a week", () => {
    expect(describeDay(new Date("2026-11-12T19:00:00Z"), now, opts)).toBe(
      "Nov 12 at 7:00 PM",
    );
  });

  it("counts calendar days in the viewer's zone, not 24-hour blocks", () => {
    // 23:30 London is already tomorrow in Lagos (UTC+1)
    const late = new Date("2026-11-01T23:30:00Z");
    expect(describeDay(late, now, opts)).toBe("today at 11:30 PM");
    expect(
      describeDay(late, now, { locale: "en-US", timeZone: "Africa/Lagos" }),
    ).toBe("tomorrow at 12:30 AM");
  });
});
