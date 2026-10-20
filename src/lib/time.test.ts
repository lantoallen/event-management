import { describe, expect, it } from "vitest";
import {
  formatTimeRange,
  fromLocalInput,
  manilaDayKey,
  manilaStartOfDay,
  manilaWeekday,
  relativeDays,
  startsIn,
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

const at = (local: string) => fromLocalInput(local);

describe("startsIn", () => {
  const start = at("2026-10-24T18:00");
  const end = at("2026-10-24T21:00");

  it("counts minutes, then hours, then days", () => {
    expect(startsIn(start, end, at("2026-10-24T17:59"))).toBe("Starts in 1 minute");
    expect(startsIn(start, end, at("2026-10-24T17:15"))).toBe("Starts in 45 minutes");
    expect(startsIn(start, end, at("2026-10-24T09:00"))).toBe("Starts in 9 hours");
    expect(startsIn(start, end, at("2026-10-23T20:00"))).toBe("Starts tomorrow");
    expect(startsIn(start, end, at("2026-10-20T08:00"))).toBe("Starts in 4 days");
    expect(startsIn(start, end, at("2026-10-01T08:00"))).toBe("Starts in 3 weeks");
  });

  it("uses hours across midnight when it's only a few hours away", () => {
    expect(startsIn(at("2026-10-25T06:00"), at("2026-10-25T09:00"), at("2026-10-24T22:00"))).toBe("Starts in 8 hours");
  });

  it("says when it's on or over", () => {
    expect(startsIn(start, end, at("2026-10-24T19:00"))).toBe("Happening now");
    expect(startsIn(start, end, at("2026-10-24T21:00"))).toBe("Ended");
  });
});
