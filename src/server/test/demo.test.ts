import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

  it("filters by category and search text", async () => {
    const food = await h.request("GET", "/api/events?category=food");
    expect(food.json.events.every((e: { category: string }) => e.category === "food")).toBe(true);
    const search = await h.request("GET", "/api/events?q=taal");
    expect(search.json.events.map((e: { title: string }) => e.title)).toContain("Heritage food walk in Taal");
    // Wildcards in the search box are treated as plain text.
    expect((await h.request("GET", "/api/events?q=%25")).json.events).toHaveLength(0);
  });

  it("ignores filter values it doesn't know instead of failing", async () => {
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
