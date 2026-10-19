import { and, eq, gt, ne } from "drizzle-orm";
import type { Db } from "../db/client";
import { events, registrations, sessions, users } from "../db/schema";
import { conflict, forbidden, unauthorized } from "../errors";
import { DEMO_ACCOUNTS } from "../seed";
import { createSession, hashPassword, verifyPassword, type SessionUser } from "./auth";
import { cancelRegistration } from "./registrations";

const sampleEmails = new Set<string>(Object.values(DEMO_ACCOUNTS).map((a) => a.email));

// In demo mode everyone shares the sample accounts, so nobody gets to rename
// or delete them for everyone else.
function guardSample(user: SessionUser, demo: boolean) {
  if (demo && sampleEmails.has(user.email)) {
    throw forbidden("This is a shared sample account, so it can't be changed. Make your own account to try this.");
  }
}

export async function updateName(db: Db, user: SessionUser, name: string, { demo }: { demo: boolean }) {
  guardSample(user, demo);
  const [updated] = await db
    .update(users)
    .set({ name: name.trim() })
    .where(eq(users.id, user.id))
    .returning({ id: users.id, name: users.name, email: users.email });
  return updated;
}

// Checks the current password (accounts made without one can set it
// directly), then signs out every other session.
export async function changePassword(
  db: Db,
  user: SessionUser,
  { current, next }: { current?: string; next: string },
  { demo, now }: { demo: boolean; now: Date },
) {
  guardSample(user, demo);
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  if (row.passwordHash && !(await verifyPassword(current ?? "", row.passwordHash))) {
    throw unauthorized("Your current password isn't right.");
  }
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  return createSession(db, user.id, now);
}

export async function deleteAccount(
  db: Db,
  user: SessionUser,
  password: string | undefined,
  { demo, now, ticketUrl }: { demo: boolean; now: Date; ticketUrl: (code: string) => string },
) {
  guardSample(user, demo);
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  if (row.passwordHash && !(await verifyPassword(password ?? "", row.passwordHash))) {
    throw unauthorized("That password isn't right.");
  }

  const [upcoming] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.organizerId, user.id), eq(events.status, "published"), gt(events.endsAt, now)))
    .limit(1);
  if (upcoming) {
    throw conflict(
      "has_upcoming_events",
      "You're organizing upcoming events. Cancel them first so the people registered get told.",
    );
  }

  // Give up seats the normal way, so people on waitlists move up and get
  // their tickets, instead of the rows just disappearing.
  const active = await db
    .select({ eventId: registrations.eventId })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(and(eq(registrations.userId, user.id), ne(registrations.status, "cancelled"), gt(events.startsAt, now)));
  const emailIds: string[] = [];
  for (const { eventId } of active) {
    emailIds.push(...(await cancelRegistration(db, eventId, user, { now, ticketUrl })).emailIds);
  }

  await db.delete(users).where(eq(users.id, user.id));
  return { emailIds };
}
