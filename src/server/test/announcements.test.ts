import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

async function setup() {
  const org = await h.user("Host Person");
  const event = await h.event(org, { capacity: 1, title: "Room change test" });
  const [going, waiting] = [await h.user("Going Person"), await h.user("Waiting Person")];
  await going.as("POST", `/api/events/${event.id}/registrations`);
  await waiting.as("POST", `/api/events/${event.id}/registrations`);
  return { org, event, going, waiting };
}

const message = { subject: "We moved to Room 5", body: "Same time, but we're in Room 5 on the 2nd floor now." };

describe("messaging attendees", () => {
  it("emails the people going, and the waitlist only when asked", async () => {
    const { org, event, going, waiting } = await setup();
    h.sent.length = 0;
    const res = await org.as("POST", `/api/organizer/events/${event.id}/announcements`, message);
    expect(res.status).toBe(201);
    expect(res.json.message.recipientCount).toBe(1);
    expect(h.sent.map((m) => m.to)).toEqual([going.email]);
    expect(h.sent[0].subject).toBe("Room change test: We moved to Room 5");
    expect(h.sent[0].text).toContain("Host Person sent a message");

    h.sent.length = 0;
    await org.as("POST", `/api/organizer/events/${event.id}/announcements`, { ...message, includeWaitlist: true });
    expect(h.sent.map((m) => m.to).sort()).toEqual([going.email, waiting.email].sort());

    const inbox = (await going.as("GET", "/api/me/inbox")).json.emails;
    expect(inbox[0]).toMatchObject({ kind: "announcement", subject: "Room change test: We moved to Room 5" });
    const sent = (await org.as("GET", `/api/organizer/events/${event.id}/announcements`)).json.messages;
    expect(sent).toHaveLength(2);
  });

  it("caps messages at 5 an hour per event", async () => {
    const { org, event } = await setup();
    for (let i = 0; i < 5; i++) {
      expect((await org.as("POST", `/api/organizer/events/${event.id}/announcements`, message)).status).toBe(201);
    }
    const sixth = await org.as("POST", `/api/organizer/events/${event.id}/announcements`, message);
    expect(sixth.json.error.code).toBe("too_many_messages");
  });

  it("only lets the organizer send, and not to an empty event", async () => {
    const { event, going } = await setup();
    expect((await going.as("POST", `/api/organizer/events/${event.id}/announcements`, message)).status).toBe(403);
    const org = await h.user();
    const empty = await h.event(org);
    const res = await org.as("POST", `/api/organizer/events/${empty.id}/announcements`, message);
    expect(res.json.error.code).toBe("no_recipients");
  });
});
