import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatTicketCode, normalizeTicketCode } from "../services/registrations";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

async function setup(capacity = 2) {
  const org = await h.user("Organizer");
  const event = await h.event(org, { capacity });
  const [a, b, c] = [await h.user("Ana Cruz"), await h.user("Ben Reyes"), await h.user("Cy Ramos")];
  const codes: string[] = [];
  for (const p of [a, b, c]) {
    codes.push((await p.as("POST", `/api/events/${event.id}/registrations`)).json.registration.ticketCode);
  }
  return { org, event, people: [a, b, c], codes };
}

describe("check-in", () => {
  it("checks a ticket in once, and says so if it's scanned again", async () => {
    const { org, event, codes } = await setup();
    const first = await org.as("POST", `/api/organizer/events/${event.id}/check-ins`, { code: codes[0] });
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ result: "checked_in", checkedIn: 1, confirmed: 2 });
    expect(first.json.attendee.name).toBe("Ana Cruz");

    const again = await org.as("POST", `/api/organizer/events/${event.id}/check-ins`, { code: codes[0] });
    expect(again.json.result).toBe("already_checked_in");
    expect(again.json.checkedInAt).toBe(first.json.checkedInAt);
  });

  it("accepts the scanned ticket URL, lowercase, or the code with a dash", async () => {
    const { org, event, codes } = await setup();
    const url = `http://test.local/tickets/${codes[0]}`;
    expect((await org.as("POST", `/api/organizer/events/${event.id}/check-ins`, { code: url })).json.result).toBe("checked_in");
    const dashed = formatTicketCode(codes[1]).toLowerCase();
    expect((await org.as("POST", `/api/organizer/events/${event.id}/check-ins`, { code: dashed })).json.result).toBe("checked_in");
  });

  it("turns away waitlisted, cancelled, unknown, and other-event tickets", async () => {
    const { org, event, people, codes } = await setup();
    const checkIn = (code: string) => org.as("POST", `/api/organizer/events/${event.id}/check-ins`, { code });

    const waitlisted = await checkIn(codes[2]);
    expect(waitlisted.status).toBe(409);
    expect(waitlisted.json.error.message).toBe("Cy Ramos is still on the waitlist (number 1).");

    await people[0].as("DELETE", `/api/events/${event.id}/registrations/me`);
    expect((await checkIn(codes[0])).json.error.code).toBe("cancelled");
    expect((await checkIn("ZZZZZZZZZZ")).status).toBe(404);

    const other = await setup();
    expect((await checkIn(other.codes[0])).json.error.code).toBe("wrong_event");
  });

  it("only lets the organizer check people in", async () => {
    const { event, people, codes } = await setup();
    const res = await people[0].as("POST", `/api/organizer/events/${event.id}/check-ins`, { code: codes[1] });
    expect(res.status).toBe(403);
  });

  it("can undo a check-in", async () => {
    const { org, event, codes } = await setup();
    await org.as("POST", `/api/organizer/events/${event.id}/check-ins`, { code: codes[0] });
    expect((await org.as("DELETE", `/api/organizer/events/${event.id}/check-ins/${codes[0]}`)).status).toBe(200);
    const again = await org.as("POST", `/api/organizer/events/${event.id}/check-ins`, { code: codes[0] });
    expect(again.json.result).toBe("checked_in");
  });

  it("normalizes codes the same way everywhere", () => {
    expect(normalizeTicketCode(" abcde-23456 ")).toBe("ABCDE23456");
    expect(normalizeTicketCode("https://x.com/tickets/ABCDE23456?ref=qr")).toBe("ABCDE23456");
  });
});

describe("tickets", () => {
  it("lets the holder and the organizer open a ticket, but nobody else", async () => {
    const { org, people, codes } = await setup();
    expect((await people[0].as("GET", `/api/me/tickets/${codes[0]}`)).json.ticket.holder.name).toBe("Ana Cruz");
    expect((await org.as("GET", `/api/me/tickets/${codes[0]}`)).status).toBe(200);
    expect((await people[1].as("GET", `/api/me/tickets/${codes[0]}`)).status).toBe(404);
  });
});

describe("stats and export", () => {
  it("counts confirmed, waitlisted, cancelled and checked-in people", async () => {
    const { org, event, people, codes } = await setup(2);
    await org.as("POST", `/api/organizer/events/${event.id}/check-ins`, { code: codes[0] });
    await people[1].as("DELETE", `/api/events/${event.id}/registrations/me`);

    const { stats } = (await org.as("GET", `/api/organizer/events/${event.id}/stats`)).json;
    // Ben cancelled, so Cy moved up from the waitlist.
    expect(stats).toMatchObject({ capacity: 2, confirmed: 2, waitlisted: 0, cancelled: 1, checkedIn: 1 });
    expect(stats.checkInRate).toBe(0.5);
    expect(stats.daily.reduce((n: number, d: { count: number }) => n + d.count, 0)).toBe(3);
  });

  it("exports attendees as CSV and defuses spreadsheet formulas in names", async () => {
    const org = await h.user("Organizer");
    const event = await h.event(org, { capacity: 5 });
    const sneaky = await h.user('=HYPERLINK("http://evil.example","click")');
    await sneaky.as("POST", `/api/events/${event.id}/registrations`);
    const plain = await h.user("Dela Cruz, Juan");
    await plain.as("POST", `/api/events/${event.id}/registrations`);

    const res = await org.as("GET", `/api/organizer/events/${event.id}/attendees/export`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);

    const lines = res.text.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Name,Email,Status,Waitlist position,Registered,Checked in,Ticket code");
    expect(lines[1].startsWith(`"'=HYPERLINK(""http://evil.example"",""click"")"`)).toBe(true);
    expect(lines[2].startsWith(`"Dela Cruz, Juan",`)).toBe(true);
  });
});

describe("organizer dashboard", () => {
  it("lists my events with their counts", async () => {
    const { org } = await setup(2);
    const { events } = (await org.as("GET", "/api/organizer/events")).json;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ confirmed: 2, waitlisted: 1, checkedIn: 0 });
  });

  it("publishes drafts and only deletes drafts", async () => {
    const org = await h.user();
    const draft = await h.event(org, { publish: false });
    expect((await org.as("POST", `/api/organizer/events/${draft.id}/publish`)).json.event.status).toBe("published");
    expect((await org.as("DELETE", `/api/organizer/events/${draft.id}`)).json.error.code).toBe("not_draft");
    const other = await h.event(org, { publish: false });
    expect((await org.as("DELETE", `/api/organizer/events/${other.id}`)).status).toBe(200);
  });

  it("duplicates an event as a draft a week later, with nobody registered", async () => {
    const { org, event } = await setup(2);
    const res = await org.as("POST", `/api/organizer/events/${event.id}/duplicate`);
    expect(res.status).toBe(201);
    const copy = res.json.event;
    const original = (await org.as("GET", `/api/organizer/events/${event.id}`)).json.event;
    expect(copy).toMatchObject({ status: "draft", title: original.title, capacity: 2 });
    expect(new Date(copy.startsAt).getTime() - new Date(original.startsAt).getTime()).toBe(7 * 86_400_000);
    expect(copy.slug).not.toBe(original.slug);
    expect((await org.as("GET", `/api/organizer/events/${copy.id}/attendees`)).json.attendees).toHaveLength(0);

    const other = await h.user();
    expect((await other.as("POST", `/api/organizer/events/${event.id}/duplicate`)).status).toBe(403);
  });

  it("moves a copy of a past event into the future", async () => {
    const org = await h.user();
    const event = await h.event(org, { startsAt: h.hoursFromNow(2), endsAt: h.hoursFromNow(3) });
    const start = h.now;
    h.setNow(new Date(start.getTime() + 20 * 86_400_000));
    const copy = (await org.as("POST", `/api/organizer/events/${event.id}/duplicate`)).json.event;
    expect(new Date(copy.startsAt).getTime()).toBeGreaterThan(h.now.getTime());
    h.setNow(start);
  });

  it("validates event input with readable messages", async () => {
    const org = await h.user();
    const bad = await org.as("POST", "/api/organizer/events", {
      title: "Ok title",
      summary: "Summary that is long enough",
      description: "Long enough description for the validator.",
      category: "tech",
      startsAt: h.hoursFromNow(5),
      endsAt: h.hoursFromNow(4),
      isOnline: false,
      location: "Somewhere",
      city: "Lipa City",
      capacity: 10,
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error.message).toBe("The event has to end after it starts.");

    const online = await org.as("POST", "/api/organizer/events", {
      title: "Ok title",
      summary: "Summary that is long enough",
      description: "Long enough description for the validator.",
      category: "tech",
      startsAt: h.hoursFromNow(5),
      endsAt: h.hoursFromNow(6),
      isOnline: true,
      location: "Zoom",
      capacity: 10,
    });
    expect(online.json.error.message).toBe("For online events, put the meeting link in the location.");
  });

  it("won't edit an event that already happened, or move a live one into the past", async () => {
    const org = await h.user();
    const event = await h.event(org, { startsAt: h.hoursFromNow(2), endsAt: h.hoursFromNow(3) });
    const current = (await org.as("GET", `/api/organizer/events/${event.id}`)).json.event;

    const past = await org.as("PATCH", `/api/organizer/events/${event.id}`, {
      ...current,
      startsAt: h.hoursFromNow(-5),
      endsAt: h.hoursFromNow(-4),
    });
    expect(past.status).toBe(400);
    expect(past.json.error.message).toBe("Pick a start time in the future.");

    const start = h.now;
    h.setNow(new Date(start.getTime() + 4 * 3_600_000));
    const ended = await org.as("PATCH", `/api/organizer/events/${event.id}`, { ...current, title: "Too late" });
    h.setNow(start);
    expect(ended.json.error.code).toBe("event_ended");
  });

  it("tells attendees when the time or place changes", async () => {
    const { org, event, people } = await setup(2);
    h.sent.length = 0;
    const current = (await org.as("GET", `/api/organizer/events/${event.id}`)).json.event;
    await org.as("PATCH", `/api/organizer/events/${event.id}`, { ...current, location: "New venue" });
    expect(h.sent.map((m) => m.to).sort()).toEqual(people.map((p) => p.email).sort());
    h.sent.length = 0;
    await org.as("PATCH", `/api/organizer/events/${event.id}`, { ...current, location: "New venue", title: "Renamed" });
    expect(h.sent).toHaveLength(0);
  });
});
