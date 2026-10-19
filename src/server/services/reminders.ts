import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import type { Db } from "../db/client";
import { events, registrations, users } from "../db/schema";
import { queueEmails, templates } from "./email";

// Emails everyone confirmed for an event that starts within the next day.
// `reminder_sent_at` makes it safe to run more than once.
export async function queueReminders(db: Db, now: Date, ticketUrl: (code: string) => string) {
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ reg: registrations, event: events, user: { id: users.id, name: users.name, email: users.email } })
      .from(registrations)
      .innerJoin(events, eq(events.id, registrations.eventId))
      .innerJoin(users, eq(users.id, registrations.userId))
      .where(
        and(
          eq(events.status, "published"),
          gt(events.startsAt, now),
          lte(events.startsAt, new Date(now.getTime() + 24 * 60 * 60 * 1000)),
          eq(registrations.status, "confirmed"),
          isNull(registrations.reminderSentAt),
        ),
      )
      .for("update", { of: registrations });
    if (due.length === 0) return [];

    await tx
      .update(registrations)
      .set({ reminderSentAt: now })
      .where(inArray(registrations.id, due.map((d) => d.reg.id)));
    return queueEmails(
      tx,
      due.map((d) => templates.reminder(d.user, d.event, ticketUrl(d.reg.ticketCode), now)),
    );
  });
}
