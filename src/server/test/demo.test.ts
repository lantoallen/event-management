import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { manilaDayKey } from "@/lib/time";
import { seed } from "../seed";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
  await seed(h.db, h.now, "http://test.local");
});
afterAll(() => h.close());

async function demo(as: "organizer" | "attendee") {
  const res = await h.request("POST", "/api/auth/demo", { body: { as } });
  expect(res.status).toBe(200);
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  return (method: string, path: string, body?: unknown) => h.request(method, path, { body, cookie });
}

describe("sample data", () => {
  it("lists upcoming published events, soonest first", async () => {
    const { json } = await h.request("GET", "/api/events");
    expect(json.events.length).toBe(12);
    expect(json.hasMore).toBe(true);
    const starts = json.events.map((e: { startsAt: string }) => e.startsAt);
    expect([...starts].sort()).toEqual(starts);
    expect(json.events.some((e: { status: string }) => e.status !== "published")).toBe(false);
  });

  it("counts upcoming public events for the home page", async () => {
    const { json } = await h.request("GET", "/api/events/overview");
    // 14 upcoming published events in the sample data; the mural day falls
    // on day 30, just outside the window.
    expect(json.total).toBe(13);
    expect(json.byCategory.tech).toBe(3);
    expect(json.byCategory.food).toBe(2);
  });

  it("filters by category and search text", async () => {
    const food = await h.request("GET", "/api/events?category=food");
    expect(food.json.events.every((e: { category: string }) => e.category === "food")).toBe(true);
    const search = await h.request("GET", "/api/events?q=taal");
    expect(search.json.events.map((e: { title: string }) => e.title)).toContain("Heritage food walk in Taal");
    // Wildcards in the search box are treated as plain text.
    expect((await h.request("GET", "/api/events?q=%25")).json.events).toHaveLength(0);
  });

  it("counts events per day for the day picker, matching the day filter", async () => {
    const { json } = await h.request("GET", "/api/events/days");
    expect(json.days).toHaveLength(14);
    expect(json.days[0].day).toBe(manilaDayKey(h.now));
    const busy = json.days.filter((d: { count: number }) => d.count > 0);
    expect(busy.length).toBeGreaterThan(3);
    for (const { day, count } of busy) {
      const list = (await h.request("GET", `/api/events?day=${day}`)).json.events;
      expect(list).toHaveLength(count);
      expect(list.every((e: { startsAt: string }) => manilaDayKey(e.startsAt) === day)).toBe(true);
    }
    // The counts follow the category filter too.
    const food = (await h.request("GET", "/api/events/days?category=food")).json.days;
    const foodTotal = food.reduce((n: number, d: { count: number }) => n + d.count, 0);
    expect(foodTotal).toBeLessThan(busy.reduce((n: number, d: { count: number }) => n + d.count, 0));
  });

  it("ignores filter values it doesn't know instead of failing", async () => {
    const all = (await h.request("GET", "/api/events")).json.events;
    expect((await h.request("GET", "/api/events?day=2026-02-31")).json.events).toEqual(all);
    expect((await h.request("GET", "/api/events?category=nope&when=someday")).status).toBe(200);
  });

  it("gives the demo attendee a ticket in every state", async () => {
    const as = await demo("attendee");
    const { tickets } = (await as("GET", "/api/me/tickets")).json;
    const byTitle = Object.fromEntries(tickets.map((t: { event: { title: string } }) => [t.event.title, t]));
    expect(byTitle["Open mic night"].status).toBe("confirmed");
    expect(byTitle["Heritage food walk in Taal"]).toMatchObject({ status: "waitlisted", waitlistPosition: 3 });
    expect(byTitle["Intro to Git and GitHub"].checkedInAt).not.toBeNull();
    expect(byTitle["Night market pop-up"].event.status).toBe("cancelled");

    const { emails } = (await as("GET", "/api/me/inbox")).json;
    expect(emails.map((e: { subject: string }) => e.subject)).toContain("You're on the waitlist for Heritage food walk in Taal");
  });

  it("gives the demo organizer events with real numbers", async () => {
    const as = await demo("organizer");
    const { events } = (await as("GET", "/api/organizer/events")).json;
    const api = events.find((e: { title: string }) => e.title === "Build a REST API in one afternoon");
    expect(api).toMatchObject({ capacity: 30, confirmed: 30, waitlisted: 6 });
    const git = events.find((e: { title: string }) => e.title === "Intro to Git and GitHub");
    expect(git.checkedIn).toBeGreaterThan(20);
    expect(events.some((e: { status: string }) => e.status === "draft")).toBe(true);
  });

  it("queues reminders for tomorrow's events only once", async () => {
    const first = await h.request("GET", "/api/cron/reminders");
    // Only "Design to code study group" (6 PM today) starts within a day.
    expect(first.json.queued).toBe(18);
    // The harness clock is 10 AM, so the 6 PM session is later today.
    expect(h.sent.some((m) => m.subject === "Today: Design to code study group")).toBe(true);
    expect(h.sent.some((m) => m.subject.startsWith("Tomorrow:"))).toBe(false);
    expect((await h.request("GET", "/api/cron/reminders")).json.queued).toBe(0);
  });

  it("resets back to the sample data", async () => {
    await h.user("Visitor");
    const res = await h.request("GET", "/api/cron/reset-demo");
    expect(res.status).toBe(200);
    expect((await h.db.query.users.findMany()).some((u) => u.name === "Visitor")).toBe(false);
  });
});

describe("outside demo mode", () => {
  it("refuses sample sign-in and never resets the database", async () => {
    const real = await createHarness({ demo: false });
    await seed(real.db, real.now, "http://test.local");
    const person = await real.user("Real Person");

    expect((await real.request("POST", "/api/auth/demo", { body: { as: "attendee" } })).status).toBe(404);
    expect((await real.request("GET", "/api/cron/reset-demo")).status).toBe(404);
    const users = await real.db.query.users.findMany();
    expect(users.some((u) => u.id === person.id)).toBe(true);
    await real.close();
  });
});
