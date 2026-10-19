import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

const linkIn = (body: string) => body.match(/reset-password\?token=([\w-]+)/)?.[1];

describe("forgot password", () => {
  it("answers the same for unknown emails and sends nothing", async () => {
    h.sent.length = 0;
    const res = await h.request("POST", "/api/auth/forgot", { body: { email: "nobody@example.com" } });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, emailEnabled: true });
    expect(h.sent).toHaveLength(0);
  });

  it("emails a link that sets a new password once, and signs out old sessions", async () => {
    const person = await h.user("Forgetful Person");
    h.sent.length = 0;
    await h.request("POST", "/api/auth/forgot", { body: { email: person.email.toUpperCase() } });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].subject).toBe("Reset your password");
    const token = linkIn(h.sent[0].text)!;
    expect(token).toBeTruthy();

    const reset = await h.request("POST", "/api/auth/reset", { body: { token, password: "a brand new one" } });
    expect(reset.status).toBe(200);
    expect(reset.headers.get("set-cookie")).toMatch(/sid=/);

    // The session from before the reset no longer works.
    expect((await person.as("GET", "/api/auth/me")).json.user).toBeNull();
    // The new password works and the old one doesn't.
    const login = (password: string) => h.request("POST", "/api/auth/login", { body: { email: person.email, password } });
    expect((await login("a brand new one")).status).toBe(200);
    expect((await login("correct horse")).status).toBe(401);
    // The link only works once.
    const again = await h.request("POST", "/api/auth/reset", { body: { token, password: "yet another one" } });
    expect(again.json.error.code).toBe("invalid_token");
  });

  it("expires links after an hour", async () => {
    const person = await h.user();
    h.sent.length = 0;
    await h.request("POST", "/api/auth/forgot", { body: { email: person.email } });
    const token = linkIn(h.sent[0].text)!;
    const start = h.now;
    h.setNow(new Date(start.getTime() + 61 * 60_000));
    const res = await h.request("POST", "/api/auth/reset", { body: { token, password: "too late now" } });
    h.setNow(start);
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("invalid_token");
  });

  it("stores only a hash of the token", async () => {
    const person = await h.user();
    h.sent.length = 0;
    await h.request("POST", "/api/auth/forgot", { body: { email: person.email } });
    const token = linkIn(h.sent[0].text)!;
    const rows = await h.db.query.passwordResets.findMany();
    expect(rows.some((r) => r.id === token)).toBe(false);
  });
});
