import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { passwordResets, sessions, users } from "../db/schema";
import { badRequest, conflict, unauthorized } from "../errors";

export type SessionUser = { id: string; name: string; email: string };

export const SESSION_COOKIE = "sid";
export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

// scrypt is built into Node, so there's no native module to install.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

function scryptAsync(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function signUp(db: Db, input: { name: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) throw conflict("email_taken", "There's already an account with that email.");
  const [user] = await db
    .insert(users)
    .values({ name: input.name.trim(), email, passwordHash: await hashPassword(input.password) })
    .returning({ id: users.id, name: users.name, email: users.email });
  return user;
}

export async function logIn(db: Db, input: { email: string; password: string }) {
  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(input.email)));
  // Same message either way so the form doesn't reveal which emails exist.
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw unauthorized("That email and password don't match.");
  }
  return { id: user.id, name: user.name, email: user.email };
}

export async function createSession(db: Db, userId: string, now: Date) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getSessionUser(db: Db, token: string, now: Date) {
  const id = hashToken(token);
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)));
  return (row ?? null) satisfies SessionUser | null;
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

const RESET_MINUTES = 60;

// Returns null for unknown emails so the caller can answer the same way
// either way and not reveal who has an account.
export async function requestPasswordReset(db: Db, email: string, now: Date) {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)));
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({
    id: hashToken(token),
    userId: user.id,
    expiresAt: new Date(now.getTime() + RESET_MINUTES * 60_000),
  });
  return { user, token };
}

export async function resetPassword(db: Db, token: string, password: string, now: Date) {
  return db.transaction(async (tx) => {
    const [reset] = await tx
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.id, hashToken(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now)))
      .for("update");
    if (!reset) throw badRequest("This reset link has expired or was already used. Ask for a new one.", "invalid_token");

    await tx.update(passwordResets).set({ usedAt: now }).where(eq(passwordResets.id, reset.id));
    const [user] = await tx
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, reset.userId))
      .returning({ id: users.id, name: users.name, email: users.email });
    // Whoever knew the old password is signed out everywhere.
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    return user;
  });
}
