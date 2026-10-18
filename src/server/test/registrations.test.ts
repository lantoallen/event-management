import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

const register = (person: Awaited<ReturnType<Harness["user"]>>, eventId: string) =>
  person.as("POST", `/api/events/${eventId}/registrations`);
const cancel = (person: Awaited<ReturnType<Harness["user"]>>, eventId: string) =>
  person.as("DELETE", `/api/events/${eventId}/registrations/me`);

async function attendees(organizer: Awaited<ReturnType<Harness["user"]>>, eventId: string) {
  const res = await organizer.as("GET", `/api/organizer/events/${eventId}/attendees`);
  return res.json.attendees as { name: string; status: string; waitlistPosition: number | null }[];
}

describe("capacity and waitlist", () => {
  it("confirms people until the event is full, then puts the rest on the waitlist in order", async () => {
    const org = await h.user("Organizer A");
    const event = await h.event(org, { capacity: 2 });
    const [a, b, c, d] = [await h.user("Ana"), await h.user("Ben"), await h.user("Cy"), await h.user("Dee")];

    expect((await register(a, event.id)).json.registration.status).toBe("confirmed");
    expect((await register(b, event.id)).json.registration.status).toBe("confirmed");
    const third = await register(c, event.id);
    expect(third.json.registration).toMatchObject({ status: "waitlisted", waitlistPosition: 1 });
    expect((await register(d, event.id)).json.registration.waitlistPosition).toBe(2);

    const page = await a.as("GET", `/api/events/${event.slug}`);
    expect(page.json.event).toMatchObject({ confirmed: 2, waitlisted: 2, spotsLeft: 0 });
  });

  it("moves the first person on the waitlist up when someone cancels, and emails them", async () => {
    const org = await h.user("Organizer B");
    const event = await h.event(org, { capacity: 1 });
    const [a, b, c] = [await h.user("Ana"), await h.user("Ben"), await h.user("Cy")];
    await register(a, event.id);
    await register(b, event.id);
    await register(c, event.id);

    h.sent.length = 0;
    expect((await cancel(a, event.id)).status).toBe(200);

    const list = await attendees(org, event.id);
    expect(list.find((x) => x.name === "Ben")?.status).toBe("confirmed");
    expect(list.find((x) => x.name === "Cy")).toMatchObject({ status: "waitlisted", waitlistPosition: 1 });
    expect(h.sent.map((m) => [m.to, m.subject])).toEqual([
      [a.email, `Your spot at Test meetup was cancelled`],
      [b.email, `A spot opened up: Test meetup`],
    ]);
  });

  it("leaving the waitlist doesn't promote anyone", async () => {
    const org = await h.user("Organizer C");
    const event = await h.event(org, { capacity: 1 });
    const [a, b, c] = [await h.user(), await h.user(), await h.user()];
    await register(a, event.id);
    await register(b, event.id);
    await register(c, event.id);
    await cancel(b, event.id);

    const list = await attendees(org, event.id);
    expect(list.filter((x) => x.status === "confirmed")).toHaveLength(1);
    expect(list.filter((x) => x.status === "waitlisted")).toHaveLength(1);
  });

  it("never gives out more seats than the capacity when everyone registers at once", async () => {
    const org = await h.user("Organizer D");
    const event = await h.event(org, { capacity: 5 });
    const people = await Promise.all(Array.from({ length: 20 }, () => h.user()));

    const results = await Promise.all(people.map((p) => register(p, event.id)));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const statuses = results.map((r) => r.json.registration.status);
    expect(statuses.filter((s) => s === "confirmed")).toHaveLength(5);
    expect(statuses.filter((s) => s === "waitlisted")).toHaveLength(15);

    const positions = results
      .map((r) => r.json.registration.waitlistPosition)
      .filter((p): p is number => p !== null)
      .sort((x, y) => x - y);
    expect(positions).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("sends someone who cancels and comes back to the end of the line", async () => {
    const org = await h.user("Organizer E");
    const event = await h.event(org, { capacity: 1 });
    const [a, b, c] = [await h.user("Ana"), await h.user("Ben"), await h.user("Cy")];
    await register(a, event.id);
    await register(b, event.id);
    await register(c, event.id);
    await cancel(b, event.id);
    const again = await register(b, event.id);
    expect(again.json.registration).toMatchObject({ status: "waitlisted", waitlistPosition: 2 });
  });

  it("promotes people when the organizer makes the event bigger", async () => {
    const org = await h.user("Organizer F");
    const event = await h.event(org, { capacity: 1 });
    const people = [await h.user(), await h.user(), await h.user()];
    for (const p of people) await register(p, event.id);

    const current = (await org.as("GET", `/api/organizer/events/${event.id}`)).json.event;
    const res = await org.as("PATCH", `/api/organizer/events/${event.id}`, { ...current, capacity: 3 });
    expect(res.status).toBe(200);
    const list = await attendees(org, event.id);
    expect(list.every((x) => x.status === "confirmed")).toBe(true);
  });

  it("won't shrink the event below the number of confirmed people", async () => {
    const org = await h.user("Organizer G");
    const event = await h.event(org, { capacity: 3 });
    for (const p of [await h.user(), await h.user()]) await register(p, event.id);
    const current = (await org.as("GET", `/api/organizer/events/${event.id}`)).json.event;
    const res = await org.as("PATCH", `/api/organizer/events/${event.id}`, { ...current, capacity: 1 });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe("capacity_too_low");
  });
});

describe("registration rules", () => {
  it("doesn't let you register twice", async () => {
    const org = await h.user();
    const event = await h.event(org, { capacity: 10 });
    const a = await h.user();
    await register(a, event.id);
    const again = await register(a, event.id);
    expect(again.status).toBe(409);
    expect(again.json.error.message).toBe("You're already going.");
  });

  it("doesn't let organizers register for their own event", async () => {
    const org = await h.user();
    const event = await h.event(org);
    expect((await register(org, event.id)).json.error.code).toBe("own_event");
  });

  it("needs you to be logged in", async () => {
    const org = await h.user();
    const event = await h.event(org);
    expect((await h.request("POST", `/api/events/${event.id}/registrations`)).status).toBe(401);
  });

  it("closes registration once the event starts", async () => {
    const org = await h.user();
    const event = await h.event(org, { startsAt: h.hoursFromNow(1), endsAt: h.hoursFromNow(3) });
    const a = await h.user();
    const start = h.now;
    h.setNow(new Date(start.getTime() + 2 * 3_600_000));
    expect((await register(a, event.id)).json.error.code).toBe("registration_closed");
    h.setNow(start);
  });

  it("hides drafts from everyone but the organizer", async () => {
    const org = await h.user();
    const draft = await h.event(org, { publish: false, title: "Secret draft" });
    const other = await h.user();
    expect((await other.as("GET", `/api/events/${draft.slug}`)).status).toBe(404);
    expect((await org.as("GET", `/api/events/${draft.slug}`)).status).toBe(200);
    expect((await register(other, draft.id)).status).toBe(404);
    const list = await h.request("GET", "/api/events?q=Secret");
    expect(list.json.events).toHaveLength(0);
  });

  it("keeps online meeting links private until you have a confirmed spot", async () => {
    const org = await h.user();
    const event = await h.event(org, {
      isOnline: true,
      location: "https://meet.example.com/abc",
      city: "",
      capacity: 1,
    });
    const [a, b] = [await h.user(), await h.user()];
    expect((await a.as("GET", `/api/events/${event.slug}`)).json.event.location).toBeNull();
    await register(a, event.id);
    await register(b, event.id);
    expect((await a.as("GET", `/api/events/${event.slug}`)).json.event.location).toBe("https://meet.example.com/abc");
    expect((await b.as("GET", `/api/events/${event.slug}`)).json.event.location).toBeNull();
  });

  it("emails everyone when the organizer cancels, and blocks new sign-ups", async () => {
    const org = await h.user();
    const event = await h.event(org, { capacity: 1, title: "Rained out" });
    const [a, b] = [await h.user(), await h.user()];
    await register(a, event.id);
    await register(b, event.id);
    h.sent.length = 0;

    expect((await org.as("POST", `/api/organizer/events/${event.id}/cancel`)).status).toBe(200);
    expect(h.sent.map((m) => m.to).sort()).toEqual([a.email, b.email].sort());
    expect(h.sent.every((m) => m.subject === "Cancelled: Rained out")).toBe(true);
    expect((await register(await h.user(), event.id)).json.error.code).toBe("event_cancelled");
  });

  it("stops other people from managing your event", async () => {
    const org = await h.user();
    const event = await h.event(org);
    const intruder = await h.user();
    expect((await intruder.as("GET", `/api/organizer/events/${event.id}/attendees`)).status).toBe(403);
    expect((await intruder.as("POST", `/api/organizer/events/${event.id}/cancel`)).status).toBe(403);
  });
});

describe("outbox", () => {
  it("saves every email so the inbox page can show it", async () => {
    const org = await h.user();
    const event = await h.event(org, { capacity: 1, title: "Inbox check" });
    const a = await h.user();
    await register(a, event.id);
    const inbox = await a.as("GET", "/api/me/inbox");
    expect(inbox.json.emails[0]).toMatchObject({ kind: "confirmed", subject: "You're going to Inbox check", status: "sent" });
  });
});
