import { sql } from "drizzle-orm";
import { createApp } from "../app";
import { openPglite, openPostgres, type DbHandle } from "../db/client";
import type { Mailer, OutgoingEmail } from "../services/email";

// Each test file gets its own in-memory Postgres (PGlite). Set
// TEST_DATABASE_URL to run the same tests against a real server instead,
// which CI does so the locking is tested with real concurrent connections.
export async function openTestDb(): Promise<DbHandle> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return openPglite();
  const handle = await openPostgres(url, { migrate: true });
  await handle.db.execute(sql`truncate table emails, registrations, events, sessions, users cascade`);
  return handle;
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;

export async function createHarness({ rateLimit = false, demo = true } = {}) {
  const handle = await openTestDb();
  let now = new Date("2026-11-02T02:00:00.000Z");
  const sent: OutgoingEmail[] = [];
  const mailer: Mailer = {
    async send(email) {
      sent.push(email);
      return { id: `test-${sent.length}` };
    },
  };
  const app = createApp({ db: handle.db, mailer, baseUrl: "http://test.local", now: () => now, rateLimit, demo });

  async function request(method: string, path: string, { body, cookie }: { body?: unknown; cookie?: string } = {}) {
    const res = await app.request(path, {
      method,
      headers: {
        // What a browser sends for a same-origin fetch.
        "Sec-Fetch-Site": "same-origin",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    // Tests read whatever the route returned; the assertions check its shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }

  let userCount = 0;
  async function user(name?: string) {
    const n = ++userCount;
    name ??= `Person ${n}`;
    const email = `person${n}@example.com`;
    const res = await request("POST", "/api/auth/signup", { body: { name, email, password: "correct horse" } });
    if (res.status !== 201) throw new Error(`signup failed: ${res.text}`);
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const as = (method: string, path: string, body?: unknown) => request(method, path, { body, cookie });
    return { ...res.json.user, email, cookie, as } as {
      id: string;
      name: string;
      email: string;
      cookie: string;
      as: typeof as;
    };
  }

  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();

  async function event(organizer: Awaited<ReturnType<typeof user>>, overrides: Record<string, unknown> = {}) {
    const res = await organizer.as("POST", "/api/organizer/events", {
      title: "Test meetup",
      summary: "A meetup used by the tests.",
      description: "Long enough description for the validator to accept.",
      category: "tech",
      startsAt: hoursFromNow(48),
      endsAt: hoursFromNow(50),
      isOnline: false,
      location: "Library, 2nd floor",
      city: "Lipa City",
      capacity: 2,
      publish: true,
      ...overrides,
    });
    if (res.status !== 201) throw new Error(`create event failed: ${res.text}`);
    return res.json.event as { id: string; slug: string; capacity: number };
  }

  return {
    app,
    db: handle.db,
    sent,
    request,
    user,
    event,
    hoursFromNow,
    get now() {
      return now;
    },
    setNow(date: Date) {
      now = date;
    },
    close: handle.close,
  };
}
