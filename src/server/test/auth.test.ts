import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

describe("auth", () => {
  it("signs up, keeps the session in an httpOnly cookie, and reads it back", async () => {
    const res = await h.request("POST", "/api/auth/signup", {
      body: { name: "Andrea Santos", email: "Andrea@Example.com ", password: "long enough" },
    });
    expect(res.status).toBe(201);
    expect(res.json.user).toMatchObject({ name: "Andrea Santos", email: "andrea@example.com" });

    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/sid=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const me = await h.request("GET", "/api/auth/me", { cookie: setCookie.split(";")[0] });
    expect(me.json.user.email).toBe("andrea@example.com");
  });

  it("rejects a second account with the same email, ignoring case", async () => {
    const res = await h.request("POST", "/api/auth/signup", {
      body: { name: "Someone Else", email: "ANDREA@example.com", password: "long enough" },
    });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe("email_taken");
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const wrong = await h.request("POST", "/api/auth/login", {
      body: { email: "andrea@example.com", password: "not it" },
    });
    const unknown = await h.request("POST", "/api/auth/login", {
      body: { email: "nobody@example.com", password: "not it" },
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json.error.message).toBe(unknown.json.error.message);
  });

  it("logs in with the right password", async () => {
    const res = await h.request("POST", "/api/auth/login", {
      body: { email: "andrea@example.com", password: "long enough" },
    });
    expect(res.status).toBe(200);
    expect(res.json.user.name).toBe("Andrea Santos");
  });

  it("shows the first validation message from the schema", async () => {
    const res = await h.request("POST", "/api/auth/signup", {
      body: { name: "Al", email: "al@example.com", password: "short" },
    });
    expect(res.status).toBe(400);
    expect(res.json.error.message).toBe("Use at least 8 characters for your password.");
  });

  it("ends the session on logout", async () => {
    const person = await h.user();
    expect((await person.as("POST", "/api/auth/logout")).status).toBe(200);
    expect((await person.as("GET", "/api/auth/me")).json.user).toBeNull();
    expect((await person.as("GET", "/api/me/tickets")).status).toBe(401);
  });

  it("stores only a hash of the session token", async () => {
    const person = await h.user();
    const token = person.cookie.split("=")[1];
    const rows = await h.db.query.sessions.findMany();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.id === token)).toBe(false);
  });

  it("never stores passwords in plain text", async () => {
    const rows = await h.db.query.users.findMany();
    for (const row of rows) expect(row.passwordHash).toMatch(/^scrypt\$/);
  });
});

describe("csrf", () => {
  it("rejects a form posted from another site", async () => {
    const res = await h.app.request("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://evil.example",
        "Sec-Fetch-Site": "cross-site",
      },
      body: "x=1",
    });
    expect(res.status).toBe(403);
  });
});

describe("rate limiting", () => {
  it("slows down repeated login attempts", async () => {
    const limited = await createHarness({ rateLimit: true });
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await limited.request("POST", "/api/auth/login", {
        body: { email: "x@example.com", password: "guess" },
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    await limited.close();
  });
});
