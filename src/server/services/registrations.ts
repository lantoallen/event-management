import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { events, registrations, users, type Event, type Registration } from "../db/schema";
import { conflict, notFound } from "../errors";
import type { SessionUser } from "./auth";
import { queueEmails, templates } from "./email";

// No 0/O or 1/I, so codes read out loud or typed by hand don't get mixed up.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newTicketCode() {
  return Array.from(randomBytes(10), (b) => ALPHABET[b & 31]).join("");
}

// Accepts a raw code, a code with dashes or spaces, or a scanned ticket URL.
export function normalizeTicketCode(input: string) {
  const fromUrl = input.match(/\/tickets\/([A-Za-z0-9-]+)/);
  return (fromUrl ? fromUrl[1] : input).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export { formatTicketCode } from "@/lib/tickets";

async function countConfirmed(db: Db, eventId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), eq(registrations.status, "confirmed")));
  return n;
}

export async function waitlistPosition(db: Db, reg: Pick<Registration, "eventId" | "queueNo">) {
  const [{ ahead }] = await db
    .select({ ahead: sql<number>`count(*)`.mapWith(Number) })
    .from(registrations)
    .where(
      and(
        eq(registrations.eventId, reg.eventId),
        eq(registrations.status, "waitlisted"),
        lt(registrations.queueNo, reg.queueNo),
      ),
    );
  return ahead + 1;
}

// Everyone who should hear about changes to the event.
export async function activeAttendees(db: Db, eventId: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .where(and(eq(registrations.eventId, eventId), ne(registrations.status, "cancelled")));
}

// Moves people off the waitlist, oldest first, until the event is full again.
// Call it inside a transaction that already holds the lock on the event row.
export async function fillFromWaitlist(tx: Db, event: Event, now: Date) {
  const open = event.capacity - (await countConfirmed(tx, event.id));
  if (open <= 0) return [];
  const next = await tx
    .select({ id: registrations.id })
    .from(registrations)
    .where(and(eq(registrations.eventId, event.id), eq(registrations.status, "waitlisted")))
    .orderBy(asc(registrations.queueNo))
    .limit(open)
    .for("update");
  if (next.length === 0) return [];

  const promoted = await tx
    .update(registrations)
    .set({ status: "confirmed", confirmedAt: now })
    .where(inArray(registrations.id, next.map((r) => r.id)))
    .returning({ userId: registrations.userId, ticketCode: registrations.ticketCode });
  const people = await tx
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, promoted.map((p) => p.userId)));
  const byId = new Map(people.map((p) => [p.id, p]));
  return promoted.map((p) => ({ user: byId.get(p.userId)!, ticketCode: p.ticketCode }));
}

type Ctx = { now: Date; ticketUrl: (code: string) => string };

export async function register(db: Db, eventId: string, user: SessionUser, { now, ticketUrl }: Ctx) {
  return db.transaction(async (tx) => {
    // Locking the event row makes registrations for the same event run one
    // at a time, so two people can't both take the last seat.
    const [event] = await tx.select().from(events).where(eq(events.id, eventId)).for("update");
    if (!event || event.status === "draft") throw notFound("We couldn't find that event.");
    if (event.status === "cancelled") throw conflict("event_cancelled", "This event was cancelled.");
    if (event.startsAt <= now) throw conflict("registration_closed", "Registration closed when the event started.");
    if (event.organizerId === user.id) throw conflict("own_event", "You're the organizer of this event.");

    const [existing] = await tx
      .select()
      .from(registrations)
      .where(and(eq(registrations.eventId, eventId), eq(registrations.userId, user.id)));
    if (existing && existing.status !== "cancelled") {
      throw conflict(
        "already_registered",
        existing.status === "confirmed" ? "You're already going." : "You're already on the waitlist.",
      );
    }

    const status = (await countConfirmed(tx, eventId)) < event.capacity ? "confirmed" : "waitlisted";
    const values = {
      status,
      createdAt: now,
      confirmedAt: status === "confirmed" ? now : null,
      cancelledAt: null,
      checkedInAt: null,
      reminderSentAt: null,
    } as const;

    // Someone who cancelled and comes back reuses their row and goes to the
    // back of the line.
    const [reg] = existing
      ? await tx
          .update(registrations)
          .set({ ...values, queueNo: sql`nextval('registration_queue_seq')` })
          .where(eq(registrations.id, existing.id))
          .returning()
      : await tx
          .insert(registrations)
          .values({ eventId, userId: user.id, ticketCode: newTicketCode(), ...values })
          .returning();

    const position = status === "waitlisted" ? await waitlistPosition(tx, reg) : null;
    const emailIds = await queueEmails(tx, [
      position === null
        ? templates.confirmed(user, event, ticketUrl(reg.ticketCode))
        : templates.waitlisted(user, event, position),
    ]);
    return {
      registration: { status: reg.status, ticketCode: reg.ticketCode, waitlistPosition: position },
      emailIds,
    };
  });
}

export async function cancelRegistration(db: Db, eventId: string, user: SessionUser, { now, ticketUrl }: Ctx) {
  return db.transaction(async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, eventId)).for("update");
    if (!event) throw notFound("We couldn't find that event.");

    const [reg] = await tx
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, eventId),
          eq(registrations.userId, user.id),
          ne(registrations.status, "cancelled"),
        ),
      );
    if (!reg) throw notFound("You're not registered for this event.");
    if (event.startsAt <= now) throw conflict("event_started", "The event has already started.");

    await tx
      .update(registrations)
      .set({ status: "cancelled", cancelledAt: now })
      .where(eq(registrations.id, reg.id));

    const drafts = [templates.cancelled(user, event, reg.status === "waitlisted")];
    if (reg.status === "confirmed" && event.status === "published") {
      const promoted = await fillFromWaitlist(tx, event, now);
      drafts.push(...promoted.map((p) => templates.promoted(p.user, event, ticketUrl(p.ticketCode))));
    }
    return { emailIds: await queueEmails(tx, drafts) };
  });
}

export async function listMyTickets(db: Db, userId: string) {
  const rows = await db
    .select({ reg: registrations, event: events })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(and(eq(registrations.userId, userId), ne(registrations.status, "cancelled")))
    .orderBy(desc(events.startsAt));

  return Promise.all(
    rows.map(async ({ reg, event }) => ({
      ticketCode: reg.ticketCode,
      status: reg.status,
      checkedInAt: reg.checkedInAt,
      waitlistPosition: reg.status === "waitlisted" ? await waitlistPosition(db, reg) : null,
      event: {
        slug: event.slug,
        title: event.title,
        category: event.category,
        status: event.status,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        isOnline: event.isOnline,
        city: event.city,
      },
    })),
  );
}

// A ticket can be opened by the person it belongs to and by the organizer.
export async function getTicket(db: Db, rawCode: string, viewerId: string) {
  const code = normalizeTicketCode(rawCode);
  const [row] = await db
    .select({ reg: registrations, event: events, holder: { name: users.name, email: users.email } })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .innerJoin(users, eq(users.id, registrations.userId))
    .where(eq(registrations.ticketCode, code));
  if (!row || (row.reg.userId !== viewerId && row.event.organizerId !== viewerId)) {
    throw notFound("We couldn't find that ticket.");
  }
  const { reg, event, holder } = row;
  return {
    ticketCode: reg.ticketCode,
    status: reg.status,
    checkedInAt: reg.checkedInAt,
    registeredAt: reg.createdAt,
    waitlistPosition: reg.status === "waitlisted" ? await waitlistPosition(db, reg) : null,
    holder,
    event: {
      slug: event.slug,
      title: event.title,
      status: event.status,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      isOnline: event.isOnline,
      location: event.isOnline && reg.status !== "confirmed" ? null : event.location,
      city: event.city,
    },
  };
}
