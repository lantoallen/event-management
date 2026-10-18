import { describe, expect, it } from "vitest";
import {
  formatTimeRange,
  fromLocalInput,
  manilaDayKey,
  manilaStartOfDay,
  manilaWeekday,
  relativeDays,
  toLocalInput,
} from "./time";

// All of these should give the same answers no matter what time zone the
// machine running them is in, since everything is pinned to Manila.
describe("Manila time helpers", () => {
  it("reads form input as Manila time and writes it back unchanged", () => {
    const d = fromLocalInput("2026-10-20T19:00");
    expect(d.toISOString()).toBe("2026-10-20T11:00:00.000Z");
    expect(toLocalInput(d)).toBe("2026-10-20T19:00");
  });

  it("puts late-evening UTC times on the next Manila day", () => {
    expect(manilaDayKey(new Date("2026-10-20T17:30:00Z"))).toBe("2026-10-21");
    expect(manilaDayKey(new Date("2026-10-20T15:59:00Z"))).toBe("2026-10-20");
  });

  it("finds the start of the Manila day and the weekday", () => {
    const lateNight = new Date("2026-10-20T17:30:00Z"); // Wed 1:30 AM in Manila
    expect(manilaStartOfDay(lateNight).toISOString()).toBe("2026-10-20T16:00:00.000Z");
    expect(manilaWeekday(lateNight)).toBe(3);
  });

  it("says today, tomorrow, or in a few days", () => {
    const now = new Date("2026-10-20T02:00:00Z"); // Tue 10 AM in Manila
    expect(relativeDays(new Date("2026-10-20T11:00:00Z"), now)).toBe("Today");
    expect(relativeDays(new Date("2026-10-20T16:30:00Z"), now)).toBe("Tomorrow");
    expect(relativeDays(new Date("2026-10-23T11:00:00Z"), now)).toBe("In 3 days");
    expect(relativeDays(new Date("2026-11-20T11:00:00Z"), now)).toBeNull();
  });

  it("only repeats the date in a range when the event runs past midnight", () => {
    expect(formatTimeRange("2026-10-20T11:00:00Z", "2026-10-20T13:00:00Z")).toBe("7:00 PM to 9:00 PM");
    expect(formatTimeRange("2026-10-20T14:00:00Z", "2026-10-20T17:00:00Z")).toMatch(/^10:00 PM to Oct 21, 1:00 AM$/);
  });
});
