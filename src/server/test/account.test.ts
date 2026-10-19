import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seed } from "../seed";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

describe("account settings", () => {
  it("changes your name", async () => {
    const person = await h.user("Old Name");
    const res = await person.as("PATCH", "/api/me/profile", { name: "  New Name  " });
    expect(res.json.user.name).toBe("New Name");
    expect((await person.as("GET", "/api/auth/me")).json.user.name).toBe("New Name");
  });

  it("needs the current password to set a new one, then signs out other sessions", async () => {
    const person = await h.user();
    const wrong = await person.as("POST", "/api/me/password", { current: "not it", next: "brand new pass" });
    expect(wrong.status).toBe(401);

    const ok = await person.as("POST", "/api/me/password", { current: "correct horse", next: "brand new pass" });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/sid=/);
    expect((await person.as("GET", "/api/auth/me")).json.user).toBeNull();
    const login = await h.request("POST", "/api/auth/login", { body: { email: person.email, password: "brand new pass" } });
    expect(login.status).toBe(200);
  });

  it("deleting an account gives its seat to the next person on the waitlist", async () => {
    const org = await h.user();
    const event = await h.event(org, { capacity: 1, title: "Tiny workshop" });
    const [leaving, waiting] = [await h.user(), await h.user("Next In Line")];
    await leaving.as("POST", `/api/events/${event.id}/registrations`);
    await waiting.as("POST", `/api/events/${event.id}/registrations`);

    h.sent.length = 0;
    expect((await leaving.as("DELETE", "/api/me", { password: "wrong" })).status).toBe(401);
    expect((await leaving.as("DELETE", "/api/me", { password: "correct horse" })).status).toBe(200);

    const attendees = (await org.as("GET", `/api/organizer/events/${event.id}/attendees`)).json.attendees;
    expect(attendees).toHaveLength(1);
    expect(attendees[0]).toMatchObject({ name: "Next In Line", status: "confirmed" });
    expect(h.sent.some((m) => m.to === waiting.email && m.subject === "A spot opened up: Tiny workshop")).toBe(true);
    const login = await h.request("POST", "/api/auth/login", { body: { email: leaving.email, password: "correct horse" } });
    expect(login.status).toBe(401);
  });

  it("makes organizers cancel upcoming events before deleting their account", async () => {
    const org = await h.user();
    const event = await h.event(org);
    const blocked = await org.as("DELETE", "/api/me", { password: "correct horse" });
    expect(blocked.json.error.code).toBe("has_upcoming_events");
    await org.as("POST", `/api/organizer/events/${event.id}/cancel`);
    expect((await org.as("DELETE", "/api/me", { password: "correct horse" })).status).toBe(200);
  });

  it("protects the shared sample accounts in demo mode", async () => {
    await seed(h.db, h.now, "http://test.local");
    const res = await h.request("POST", "/api/auth/demo", { body: { as: "attendee" } });
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const rename = await h.request("PATCH", "/api/me/profile", { body: { name: "Something Rude" }, cookie });
    expect(rename.status).toBe(403);
    expect((await h.request("DELETE", "/api/me", { body: {}, cookie })).status).toBe(403);
  });
});
