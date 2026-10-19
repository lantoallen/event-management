import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { announcements, registrations, users } from "../db/schema";
import { conflict } from "../errors";
import { queueEmails, templates } from "./email";
import { getOwnedEvent } from "./events";

const PER_HOUR = 5;

export async function sendAnnouncement(
  db: Db,
  {
    eventId,
    organizer,
    subject,
    body,
    includeWaitlist,
    now,
    eventUrl,
  }: {
    eventId: string;
    organizer: { id: string; name: string };
    subject: string;
    body: string;
    includeWaitlist: boolean;
    now: Date;
    eventUrl: (slug: string) => string;
  },
) {
  return db.transaction(async (tx) => {
    const event = await getOwnedEvent(tx, eventId, organizer.id, { lock: true });
    if (event.status === "draft") throw conflict("not_published", "Publish the event before messaging people.");

    // A cap so a mistake (or a bad actor) can't flood people's inboxes.
    const [{ recent }] = await tx
      .select({ recent: sql<number>`count(*)`.mapWith(Number) })
      .from(announcements)
      .where(and(eq(announcements.eventId, eventId), gt(announcements.createdAt, new Date(now.getTime() - 3_600_000))));
    if (recent >= PER_HOUR) {
      throw conflict("too_many_messages", `You can send up to ${PER_HOUR} messages an hour for one event. Try again a bit later.`);
    }

    const statuses = includeWaitlist ? (["confirmed", "waitlisted"] as const) : (["confirmed"] as const);
    const people = await tx
      .select({ id: users.id, name: users.name, email: users.email })
      .from(registrations)
      .innerJoin(users, eq(users.id, registrations.userId))
      .where(and(eq(registrations.eventId, eventId), inArray(registrations.status, [...statuses])));
    if (people.length === 0) throw conflict("no_recipients", "Nobody is registered yet, so there's no one to message.");

    const [announcement] = await tx
      .insert(announcements)
      .values({ eventId, subject, body, includeWaitlist, recipientCount: people.length, createdAt: now })
      .returning();
    const emailIds = await queueEmails(
      tx,
      people.map((p) => templates.announcement(p, event, { subject, body, from: organizer.name, url: eventUrl(event.slug) })),
    );
    return { announcement, emailIds };
  });
}

export async function listAnnouncements(db: Db, eventId: string, organizerId: string) {
  await getOwnedEvent(db, eventId, organizerId);
  return db
    .select({
      id: announcements.id,
      subject: announcements.subject,
      body: announcements.body,
      includeWaitlist: announcements.includeWaitlist,
      recipientCount: announcements.recipientCount,
      createdAt: announcements.createdAt,
    })
    .from(announcements)
    .where(eq(announcements.eventId, eventId))
    .orderBy(desc(announcements.createdAt));
}
