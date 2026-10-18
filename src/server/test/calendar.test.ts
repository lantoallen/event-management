import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toIcs } from "../services/calendar";
import { createHarness, type Harness } from "./harness";

describe("calendar file", () => {
  const event = {
    uid: "ABCDE23456@events-demo",
    title: "Lomi, barako; and more",
    startsAt: new Date("2026-11-03T08:00:00Z"),
    endsAt: new Date("2026-11-03T11:00:00Z"),
    location: "Barako Hub, Lipa-Batangas Road",
    description: "Line one\nLine two",
    url: "https://example.com/events/lomi",
  };

  it("writes UTC times and escapes text", () => {
    const ics = toIcs(event, new Date("2026-11-01T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261103T080000Z\r\n");
    expect(ics).toContain("DTEND:20261103T110000Z\r\n");
    expect(ics).toContain("SUMMARY:Lomi\\, barako\; and more\r\n");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("folds lines longer than 75 bytes", () => {
    const ics = toIcs({ ...event, title: "Sining Batangueño ".repeat(8) }, new Date());
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(ics).toMatch(/\r\n Sining|\r\n [^\r]/);
  });
});

describe("calendar route", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());

  it("gives confirmed attendees an .ics file and turns away the waitlist", async () => {
    const org = await h.user();
    const event = await h.event(org, { capacity: 1, title: "Calendar test" });
    const [a, b] = [await h.user(), await h.user()];
    const codeA = (await a.as("POST", `/api/events/${event.id}/registrations`)).json.registration.ticketCode;
    const codeB = (await b.as("POST", `/api/events/${event.id}/registrations`)).json.registration.ticketCode;

    const ok = await a.as("GET", `/api/me/tickets/${codeA}/calendar`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toMatch(/text\/calendar/);
    expect(ok.text).toContain("SUMMARY:Calendar test");

    expect((await b.as("GET", `/api/me/tickets/${codeB}/calendar`)).status).toBe(409);
    expect((await b.as("GET", `/api/me/tickets/${codeA}/calendar`)).status).toBe(404);
  });
});
