import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { formatDateTime, fromLocalInput, manilaDayKey } from "@/lib/time";
import type { Db } from "../db/client";
import { registrations, users } from "../db/schema";
import { conflict, notFound } from "../errors";
import { getOwnedEvent } from "./events";
import { formatTicketCode, normalizeTicketCode, waitlistPosition } from "./registrations";

export async function listAttendees(db: Db, eventId: string, organizerId: string) {
  await getOwnedEvent(db, eventId, organizerId);
  const rows = await db
    .select({
      id: registrations.id,
      name: users.name,
      email: users.email,
      status: registrations.status,
      ticketCode: registrations.ticketCode,
      registeredAt: registrations.createdAt,
      checkedInAt: registrations.checkedInAt,
      cancelledAt: registrations.cancelledAt,
    })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .where(eq(registrations.eventId, eventId))
    .orderBy(
      sql`case ${registrations.status} when 'confirmed' then 0 when 'waitlisted' then 1 else 2 end`,
      asc(registrations.queueNo),
    );

  // Rows are already in waitlist order, so the position is just a counter.
  let position = 0;
  return rows.map((r) => ({ ...r, waitlistPosition: r.status === "waitlisted" ? ++position : null }));
}

export async function eventStats(db: Db, eventId: string, organizerId: string, now: Date) {
  const event = await getOwnedEvent(db, eventId, organizerId);
  const rows = await db
    .select({ status: registrations.status, createdAt: registrations.createdAt, checkedInAt: registrations.checkedInAt })
    .from(registrations)
    .where(eq(registrations.eventId, eventId));

  const totals = { confirmed: 0, waitlisted: 0, cancelled: 0, checkedIn: 0 };
  const perDay = new Map<string, number>();
  for (const r of rows) {
    totals[r.status]++;
    if (r.status === "confirmed" && r.checkedInAt) totals.checkedIn++;
    const day = manilaDayKey(r.createdAt);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  // One bar per day from the first sign-up until today or the event day,
  // with empty days included so gaps show up.
  const daily: { day: string; count: number }[] = [];
  if (rows.length > 0) {
    const firstDay = [...perDay.keys()].sort()[0];
    const lastDay = manilaDayKey(new Date(Math.min(now.getTime(), event.startsAt.getTime())));
    for (let d = fromLocalInput(`${firstDay}T00:00`); manilaDayKey(d) <= lastDay; d = new Date(d.getTime() + 86_400_000)) {
      const day = manilaDayKey(d);
      daily.push({ day, count: perDay.get(day) ?? 0 });
    }
  }

  return {
    capacity: event.capacity,
    ...totals,
    fillRate: totals.confirmed / event.capacity,
    checkInRate: totals.confirmed ? totals.checkedIn / totals.confirmed : 0,
    daily: daily.slice(-30),
  };
}

export type CheckInResult = {
  result: "checked_in" | "already_checked_in";
  attendee: { name: string; email: string; ticketCode: string };
  checkedInAt: Date;
  checkedIn: number;
  confirmed: number;
};

export async function checkIn(
  db: Db,
  { eventId, organizerId, code: rawCode, now }: { eventId: string; organizerId: string; code: string; now: Date },
): Promise<CheckInResult> {
  const event = await getOwnedEvent(db, eventId, organizerId);
  if (event.status === "cancelled") throw conflict("event_cancelled", "This event was cancelled.");

  const code = normalizeTicketCode(rawCode);
  const [row] = code
    ? await db
        .select({ reg: registrations, name: users.name, email: users.email })
        .from(registrations)
        .innerJoin(users, eq(users.id, registrations.userId))
        .where(eq(registrations.ticketCode, code))
    : [];
  if (!row) throw notFound("No ticket matches that code.");
  if (row.reg.eventId !== eventId) throw conflict("wrong_event", "This ticket is for a different event.");
  if (row.reg.status === "cancelled") {
    throw conflict("cancelled", `${row.name} cancelled this registration.`);
  }
  if (row.reg.status === "waitlisted") {
    const position = await waitlistPosition(db, row.reg);
    throw conflict("waitlisted", `${row.name} is still on the waitlist (number ${position}).`);
  }

  // The `checked_in_at is null` guard means two scanners hitting the same
  // ticket at once can't both count it.
  const [updated] = await db
    .update(registrations)
    .set({ checkedInAt: now })
    .where(and(eq(registrations.id, row.reg.id), isNull(registrations.checkedInAt)))
    .returning({ checkedInAt: registrations.checkedInAt });

  const [counts] = await db
    .select({
      confirmed: sql<number>`count(*)`.mapWith(Number),
      checkedIn: sql<number>`count(${registrations.checkedInAt})`.mapWith(Number),
    })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), eq(registrations.status, "confirmed")));

  const attendee = { name: row.name, email: row.email, ticketCode: row.reg.ticketCode };
  return updated
    ? { result: "checked_in", attendee, checkedInAt: updated.checkedInAt!, ...counts }
    : { result: "already_checked_in", attendee, checkedInAt: row.reg.checkedInAt!, ...counts };
}

export async function undoCheckIn(
  db: Db,
  { eventId, organizerId, code }: { eventId: string; organizerId: string; code: string },
) {
  await getOwnedEvent(db, eventId, organizerId);
  const [updated] = await db
    .update(registrations)
    .set({ checkedInAt: null })
    .where(and(eq(registrations.eventId, eventId), eq(registrations.ticketCode, normalizeTicketCode(code))))
    .returning({ id: registrations.id });
  if (!updated) throw notFound("No ticket matches that code.");
}

export async function recentCheckIns(db: Db, eventId: string, organizerId: string) {
  await getOwnedEvent(db, eventId, organizerId);
  return db
    .select({ name: users.name, ticketCode: registrations.ticketCode, checkedInAt: registrations.checkedInAt })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .where(and(eq(registrations.eventId, eventId), sql`${registrations.checkedInAt} is not null`))
    .orderBy(desc(registrations.checkedInAt))
    .limit(8);
}

// Spreadsheet apps run cells that start with these characters as formulas,
// so they get a leading apostrophe.
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function attendeesCsv(db: Db, eventId: string, organizerId: string) {
  const rows = await listAttendees(db, eventId, organizerId);
  const header = ["Name", "Email", "Status", "Waitlist position", "Registered", "Checked in", "Ticket code"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      r.status,
      r.waitlistPosition?.toString() ?? "",
      formatDateTime(r.registeredAt),
      r.checkedInAt ? formatDateTime(r.checkedInAt) : "",
      formatTicketCode(r.ticketCode),
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
