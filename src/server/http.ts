import { zValidator } from "@hono/zod-validator";
import type { Context, ValidationTargets } from "hono";
import { setCookie } from "hono/cookie";
import type { ZodType } from "zod";
import type { Db } from "./db/client";
import { badRequest, tooManyRequests, unauthorized } from "./errors";
import { SESSION_COOKIE, type SessionUser } from "./services/auth";
import type { Mailer } from "./services/email";

export type Deps = {
  db: Db;
  mailer: Mailer | null;
  baseUrl: string;
  // Tests pass a fixed clock.
  now?: () => Date;
  // Required in production for the cron routes. Locally they're open.
  cronSecret?: string;
  production?: boolean;
  // Tests sign up lots of people from one address.
  rateLimit?: boolean;
};

export type Env = {
  Variables: { deps: Deps; now: Date; user: SessionUser | null };
};

// zValidator with errors turned into our usual JSON shape, using the first
// message from the schema so the UI can show it as is.
export const validate = <Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) throw badRequest(result.error.issues[0]?.message ?? "Check the form and try again.");
  });

export function requireUser(c: Context<Env>) {
  const user = c.get("user");
  if (!user) throw unauthorized();
  return user;
}

export const ticketUrl = (c: Context<Env>) => (code: string) => `${c.get("deps").baseUrl}/tickets/${code}`;

export function setSessionCookie(c: Context<Env>, token: string, expires: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
    path: "/",
    expires,
  });
}

// Fixed-window limit kept in memory. On serverless each instance has its own
// counter, which is fine for slowing down password guessing on a demo.
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(c: Context<Env>, bucket: string, { max, windowMs }: { max: number; windowMs: number }) {
  if (c.get("deps").rateLimit === false) return;
  const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 10_000) hits.clear();
    return;
  }
  if (++entry.count > max) throw tooManyRequests();
}
