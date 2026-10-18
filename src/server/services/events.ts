import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { manilaStartOfDay, manilaWeekday } from "@/lib/time";
import type { Db } from "../db/client";
import { events, registrations, users, type Event, type EventCategory } from "../db/schema";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { queueEmails, templates } from "./email";
import { fillFromWaitlist, activeAttendees, waitlistPosition } from "./registrations";

export type EventInput = {
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  startsAt: Date;
  endsAt: Date;
  isOnline: boolean;
  location: string;
  city: string;
  capacity: number;
};

export const PAGE_SIZE = 12;

// Per-event registration counts, joined onto event queries.
export function countsFor(db: Db) {
  return db
    .select({
      eventId: registrations.eventId,
      confirmed: sql<number>`count(*) filter (where ${registrations.status} = 'confirmed')`.as("confirmed"),
      waitlisted: sql<number>`count(*) filter (where ${registrations.status} = 'waitlisted')`.as("waitlisted"),
      cancelled: sql<number>`count(*) filter (where ${registrations.status} = 'cancelled')`.as("cancelled"),
      checkedIn: sql<number>`count(*) filter (where ${registrations.status} = 'confirmed' and ${registrations.checkedInAt} is not null)`.as(
        "checked_in",
      ),
    })
    .from(registrations)
    .groupBy(registrations.eventId)
    .as("counts");
}

function countColumns(counts: ReturnType<typeof countsFor>) {
  return {
    confirmed: sql<number>`coalesce(${counts.confirmed}, 0)`.mapWith(Number),
    waitlisted: sql<number>`coalesce(${counts.waitlisted}, 0)`.mapWith(Number),
    cancelled: sql<number>`coalesce(${counts.cancelled}, 0)`.mapWith(Number),
    checkedIn: sql<number>`coalesce(${counts.checkedIn}, 0)`.mapWith(Number),
  };
}

// Online events keep their meeting link private until you have a ticket.
function publicLocation(event: Pick<Event, "isOnline" | "location">, canSeeLink: boolean) {
  return event.isOnline && !canSeeLink ? null : event.location;
}

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `${base || "event"}-${randomBytes(3).toString("hex")}`;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type When = "all" | "today" | "week" | "weekend" | "month";

function dateRange(when: When, now: Date): [Date, Date] | null {
  switch (when) {
    case "today":
      return [now, manilaStartOfDay(now, 1)];
    case "week":
      return [now, manilaStartOfDay(now, 7)];
    case "month":
      return [now, manilaStartOfDay(now, 30)];
    case "weekend": {
      // This coming Saturday and Sunday, or the rest of it if it's already the weekend.
      const day = manilaWeekday(now);
      const toSaturday = day === 0 ? -1 : 6 - day;
      const start = manilaStartOfDay(now, toSaturday);
      return [start > now ? start : now, manilaStartOfDay(now, toSaturday + 2)];
    }
    default:
      return null;
  }
}

export async function listPublicEvents(
  db: Db,
  filters: { q?: string; category?: EventCategory; when?: When; page?: number },
  now: Date,
) {
  const counts = countsFor(db);
  const conditions: (SQL | undefined)[] = [eq(events.status, "published"), gt(events.endsAt, now)];
  if (filters.category) conditions.push(eq(events.category, filters.category));
  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    conditions.push(
      or(ilike(events.title, pattern), ilike(events.summary, pattern), ilike(events.city, pattern)),
    );
  }
  const range = dateRange(filters.when ?? "all", now);
  if (range) conditions.push(lt(events.startsAt, range[1]));

  const page = Math.max(1, filters.page ?? 1);
  const rows = await db
    .select({
      event: events,
      organizerName: users.name,
      ...countColumns(counts),
    })
    .from(events)
    .innerJoin(users, eq(users.id, events.organizerId))
    .leftJoin(counts, eq(counts.eventId, events.id))
    .where(and(...conditions))
    .orderBy(asc(events.startsAt), asc(events.id))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  return {
    events: rows.slice(0, PAGE_SIZE).map((r) => toCard(r)),
    page,
    hasMore: rows.length > PAGE_SIZE,
  };
}

type CardRow = {
  event: Event;
  organizerName: string;
  confirmed: number;
  waitlisted: number;
};

function toCard({ event, organizerName, confirmed, waitlisted }: CardRow) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    summary: event.summary,
    category: event.category,
    status: event.status,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    isOnline: event.isOnline,
    city: event.city,
    capacity: event.capacity,
    organizerName,
    confirmed,
    waitlisted,
    spotsLeft: Math.max(0, event.capacity - confirmed),
  };
}

export async function getEventPage(db: Db, slug: string, viewerId: string | null) {
  const counts = countsFor(db);
  const [row] = await db
    .select({ event: events, organizerName: users.name, ...countColumns(counts) })
    .from(events)
    .innerJoin(users, eq(users.id, events.organizerId))
    .leftJoin(counts, eq(counts.eventId, events.id))
    .where(eq(events.slug, slug));

  const isOrganizer = !!row && row.event.organizerId === viewerId;
  if (!row || (row.event.status === "draft" && !isOrganizer)) throw notFound("We couldn't find that event.");

  let registration = null;
  if (viewerId) {
    const [reg] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.eventId, row.event.id), eq(registrations.userId, viewerId)));
    if (reg && reg.status !== "cancelled") {
      registration = {
        status: reg.status,
        ticketCode: reg.ticketCode,
        checkedInAt: reg.checkedInAt,
        waitlistPosition: reg.status === "waitlisted" ? await waitlistPosition(db, reg) : null,
      };
    }
  }

  const { event } = row;
  return {
    ...toCard(row),
    description: event.description,
    location: publicLocation(event, isOrganizer || registration?.status === "confirmed"),
    isOrganizer,
    registration,
  };
}

// Loads an event for its organizer, locking the row when inside a transaction.
export async function getOwnedEvent(db: Db, eventId: string, userId: string, { lock = false } = {}) {
  const query = db.select().from(events).where(eq(events.id, eventId));
  const [event] = lock ? await query.for("update") : await query;
  if (!event) throw notFound("We couldn't find that event.");
  if (event.organizerId !== userId) throw forbidden("Only the organizer can manage this event.");
  return event;
}

function normalizeInput(input: EventInput) {
  if (input.endsAt <= input.startsAt) throw badRequest("The event has to end after it starts.");
  if (input.isOnline && !/^https?:\/\//i.test(input.location)) {
    throw badRequest("For online events, put the meeting link in the location.");
  }
  return { ...input, city: input.isOnline ? "Online" : input.city };
}

export async function createEvent(
  db: Db,
  organizerId: string,
  input: EventInput & { publish?: boolean },
  now: Date,
) {
  const values = normalizeInput(input);
  if (input.publish && values.startsAt <= now) throw badRequest("Pick a start time in the future.");
  const [event] = await db
    .insert(events)
    .values({
      ...values,
      organizerId,
      slug: slugify(values.title),
      status: input.publish ? "published" : "draft",
    })
    .returning();
  return event;
}

export async function updateEvent(
  db: Db,
  { eventId, organizerId, input, now, ticketUrl }: {
    eventId: string;
    organizerId: string;
    input: EventInput;
    now: Date;
    ticketUrl: (code: string) => string;
  },
) {
  const values = normalizeInput(input);
  return db.transaction(async (tx) => {
    const before = await getOwnedEvent(tx, eventId, organizerId, { lock: true });
    if (before.status === "cancelled") throw conflict("event_cancelled", "Cancelled events can't be edited.");

    const [{ confirmed }] = await tx
      .select({ confirmed: sql<number>`count(*)`.mapWith(Number) })
      .from(registrations)
      .where(and(eq(registrations.eventId, eventId), eq(registrations.status, "confirmed")));
    if (values.capacity < confirmed) {
      throw conflict(
        "capacity_too_low",
        `${confirmed} people are already confirmed, so the capacity can't go below that.`,
      );
    }

    const [event] = await tx
      .update(events)
      .set({ ...values, updatedAt: now })
      .where(eq(events.id, eventId))
      .returning();

    const emailIds: string[] = [];
    if (event.status === "published") {
      // A bigger room means people on the waitlist get in.
      const promoted = await fillFromWaitlist(tx, event, now);
      emailIds.push(
        ...(await queueEmails(tx, promoted.map((p) => templates.promoted(p.user, event, ticketUrl(p.ticketCode))))),
      );

      const moved =
        before.startsAt.getTime() !== event.startsAt.getTime() ||
        before.endsAt.getTime() !== event.endsAt.getTime() ||
        before.location !== event.location ||
        before.city !== event.city;
      if (moved) {
        const promotedIds = new Set(promoted.map((p) => p.user.id));
        const people = (await activeAttendees(tx, event.id)).filter((p) => !promotedIds.has(p.id));
        emailIds.push(...(await queueEmails(tx, people.map((p) => templates.eventUpdated(p, event)))));
      }
    }
    return { event, emailIds };
  });
}

export async function publishEvent(db: Db, eventId: string, organizerId: string, now: Date) {
  const event = await getOwnedEvent(db, eventId, organizerId);
  if (event.status !== "draft") throw conflict("not_draft", "Only drafts can be published.");
  if (event.startsAt <= now) throw badRequest("This event's start time has passed. Edit it first.");
  const [updated] = await db
    .update(events)
    .set({ status: "published", updatedAt: now })
    .where(eq(events.id, eventId))
    .returning();
  return updated;
}

export async function cancelEvent(db: Db, eventId: string, organizerId: string, now: Date) {
  return db.transaction(async (tx) => {
    const event = await getOwnedEvent(tx, eventId, organizerId, { lock: true });
    if (event.status === "cancelled") throw conflict("event_cancelled", "This event is already cancelled.");
    if (event.endsAt <= now) throw conflict("event_ended", "This event already happened.");
    const people = event.status === "published" ? await activeAttendees(tx, event.id) : [];
    const [updated] = await tx
      .update(events)
      .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
      .where(eq(events.id, eventId))
      .returning();
    const emailIds = await queueEmails(tx, people.map((p) => templates.eventCancelled(p, updated)));
    return { event: updated, emailIds };
  });
}

// Copies an event into a new draft, a week later (or as many weeks as it
// takes to land in the future), so recurring events take one click.
export async function duplicateEvent(db: Db, eventId: string, organizerId: string, now: Date) {
  const source = await getOwnedEvent(db, eventId, organizerId);
  const week = 7 * 86_400_000;
  const weeks = Math.max(1, Math.ceil((now.getTime() - source.startsAt.getTime()) / week) + 1);
  const shift = weeks * week;
  const [event] = await db
    .insert(events)
    .values({
      organizerId,
      slug: slugify(source.title),
      title: source.title,
      summary: source.summary,
      description: source.description,
      category: source.category,
      status: "draft",
      startsAt: new Date(source.startsAt.getTime() + shift),
      endsAt: new Date(source.endsAt.getTime() + shift),
      isOnline: source.isOnline,
      location: source.location,
      city: source.city,
      capacity: source.capacity,
    })
    .returning();
  return event;
}

export async function deleteDraft(db: Db, eventId: string, organizerId: string) {
  const event = await getOwnedEvent(db, eventId, organizerId);
  if (event.status !== "draft") {
    throw conflict("not_draft", "Only drafts can be deleted. Cancel the event instead.");
  }
  await db.delete(events).where(eq(events.id, eventId));
}

export async function listOrganizerEvents(db: Db, organizerId: string, now: Date) {
  const counts = countsFor(db);
  const rows = await db
    .select({ event: events, ...countColumns(counts) })
    .from(events)
    .leftJoin(counts, eq(counts.eventId, events.id))
    .where(eq(events.organizerId, organizerId))
    .orderBy(desc(gte(events.endsAt, now)), asc(events.startsAt));
  return rows.map(({ event, ...c }) => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    status: event.status,
    category: event.category,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    city: event.city,
    capacity: event.capacity,
    ...c,
  }));
}
