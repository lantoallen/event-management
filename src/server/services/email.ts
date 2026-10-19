import { and, eq, inArray, desc } from "drizzle-orm";
import { APP_NAME, DEMO_MODE } from "@/lib/config";
import { formatFullDate, formatTimeRange, relativeDays } from "@/lib/time";
import type { Db } from "../db/client";
import { emails, type Event } from "../db/schema";

export type OutgoingEmail = { to: string; subject: string; text: string };

export interface Mailer {
  send(email: OutgoingEmail): Promise<{ id: string }>;
}

// Resend's HTTP API. Its free tier is enough for a demo, but it only delivers
// to addresses on a domain you've verified, so the outbox is still the source
// of truth for what the app sent.
export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(email) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text }),
      });
      if (!res.ok) throw new Error(`Resend returned ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { id: string };
      return { id: data.id };
    },
  };
}

export function mailerFromEnv(): Mailer | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return key && from ? resendMailer(key, from) : null;
}

type Recipient = { id: string; name: string; email: string };
type EventInfo = Pick<Event, "id" | "title" | "startsAt" | "endsAt" | "isOnline" | "location" | "city">;

export type EmailKind =
  | "password_reset"
  | "confirmed"
  | "waitlisted"
  | "promoted"
  | "cancelled"
  | "event_cancelled"
  | "event_updated"
  | "reminder"
  | "announcement";

type Draft = { kind: EmailKind; userId: string; eventId: string | null; to: string; subject: string; body: string };

const firstName = (name: string) => name.split(" ")[0];

function whenAndWhere(event: EventInfo) {
  const place = event.isOnline ? "Online (the link is on your ticket)" : `${event.location}, ${event.city}`;
  return `${formatFullDate(event.startsAt)}, ${formatTimeRange(event.startsAt, event.endsAt)}\n${place}`;
}

const signOff = DEMO_MODE
  ? `\n\n${APP_NAME}\nThis is a demo app, so this message was only saved to your inbox page.`
  : `\n\n${APP_NAME}`;

export const templates = {
  passwordReset(user: Recipient, resetUrl: string): Draft {
    return {
      kind: "password_reset",
      userId: user.id,
      eventId: null,
      to: user.email,
      subject: "Reset your password",
      body: `Hi ${firstName(user.name)},\n\nSomeone asked to reset the password for your ${APP_NAME} account. If it was you, set a new one here (the link works for an hour):\n\n${resetUrl}\n\nIf it wasn't you, you can ignore this email and your password stays the same.${signOff}`,
    };
  },
  confirmed(user: Recipient, event: EventInfo, ticketUrl: string): Draft {
    return {
      kind: "confirmed",
      userId: user.id,
      eventId: event.id,
      to: user.email,
      subject: `You're going to ${event.title}`,
      body: `Hi ${firstName(user.name)},\n\nYou have a spot at ${event.title}.\n\n${whenAndWhere(event)}\n\nShow this ticket at the door: ${ticketUrl}${signOff}`,
    };
  },
  waitlisted(user: Recipient, event: EventInfo, position: number): Draft {
    return {
      kind: "waitlisted",
      userId: user.id,
      eventId: event.id,
      to: user.email,
      subject: `You're on the waitlist for ${event.title}`,
      body: `Hi ${firstName(user.name)},\n\n${event.title} is full right now. You're number ${position} on the waitlist. If someone cancels, you'll move up automatically and we'll email you your ticket.\n\n${whenAndWhere(event)}${signOff}`,
    };
  },
  promoted(user: Recipient, event: EventInfo, ticketUrl: string): Draft {
    return {
      kind: "promoted",
      userId: user.id,
      eventId: event.id,
      to: user.email,
      subject: `A spot opened up: ${event.title}`,
      body: `Hi ${firstName(user.name)},\n\nGood news, someone cancelled and you're off the waitlist. You're now confirmed for ${event.title}.\n\n${whenAndWhere(event)}\n\nYour ticket: ${ticketUrl}${signOff}`,
    };
  },
  cancelled(user: Recipient, event: EventInfo, wasWaitlisted: boolean): Draft {
    return {
      kind: "cancelled",
      userId: user.id,
      eventId: event.id,
      to: user.email,
      subject: wasWaitlisted
        ? `You left the waitlist for ${event.title}`
        : `Your spot at ${event.title} was cancelled`,
      body: `Hi ${firstName(user.name)},\n\n${
        wasWaitlisted
          ? `You're no longer on the waitlist for ${event.title}.`
          : `You cancelled your registration for ${event.title}, so your ticket won't work at the door anymore.`
      } You can register again any time before the event if there's room.${signOff}`,
    };
  },
  eventCancelled(user: Recipient, event: EventInfo): Draft {
    return {
      kind: "event_cancelled",
      userId: user.id,
      eventId: event.id,
      to: user.email,
      subject: `Cancelled: ${event.title}`,
      body: `Hi ${firstName(user.name)},\n\nSorry, the organizer cancelled ${event.title}, which was set for ${formatFullDate(event.startsAt)}. You don't need to do anything.${signOff}`,
    };
  },
  eventUpdated(user: Recipient, event: EventInfo): Draft {
    return {
      kind: "event_updated",
      userId: user.id,
      eventId: event.id,
      to: user.email,
      subject: `Updated details for ${event.title}`,
      body: `Hi ${firstName(user.name)},\n\nThe organizer changed the time or place of ${event.title}. Here's the latest:\n\n${whenAndWhere(event)}${signOff}`,
    };
  },
  announcement(
    user: Recipient,
    event: EventInfo,
    message: { subject: string; body: string; from: string; url: string },
  ): Draft {
    return {
      kind: "announcement",
      userId: user.id,
      eventId: event.id,
      to: user.email,
      subject: `${event.title}: ${message.subject}`,
      body: `Hi ${firstName(user.name)},\n\n${message.from} sent a message about ${event.title}:\n\n${message.body}\n\n${whenAndWhere(event)}\nEvent page: ${message.url}\n\nYou're getting this because you registered for this event.${signOff}`,
    };
  },
  // Sent within a day of the start, which can be later today or tomorrow.
  reminder(user: Recipient, event: EventInfo, ticketUrl: string, now: Date): Draft {
    const day = relativeDays(event.startsAt, now);
    const when = day === "Today" ? "today" : day === "Tomorrow" ? "tomorrow" : "coming up soon";
    return {
      kind: "reminder",
      userId: user.id,
      eventId: event.id,
      to: user.email,
      subject: `${day === "Today" || day === "Tomorrow" ? day : "Coming up"}: ${event.title}`,
      body: `Hi ${firstName(user.name)},\n\nJust a reminder that ${event.title} is ${when}.\n\n${whenAndWhere(event)}\n\nHave your ticket ready: ${ticketUrl}${signOff}`,
    };
  },
};

// Saves emails in the same transaction as the change that caused them, so a
// registration and its confirmation are stored together or not at all.
export async function queueEmails(db: Db, drafts: Draft[]) {
  if (drafts.length === 0) return [];
  const rows = await db
    .insert(emails)
    .values(
      drafts.map((d) => ({
        userId: d.userId,
        eventId: d.eventId,
        toEmail: d.to,
        kind: d.kind,
        subject: d.subject,
        body: d.body,
      })),
    )
    .returning({ id: emails.id });
  return rows.map((r) => r.id);
}

// Runs after the transaction commits. Without a mailer the rows just stay
// "logged", which is what the demo uses.
export async function deliverEmails(db: Db, mailer: Mailer | null, ids: string[]) {
  if (!mailer || ids.length === 0) return;
  const pending = await db
    .select()
    .from(emails)
    .where(and(inArray(emails.id, ids), eq(emails.status, "logged")));
  for (const email of pending) {
    try {
      const { id } = await mailer.send({ to: email.toEmail, subject: email.subject, text: email.body });
      await db
        .update(emails)
        .set({ status: "sent", providerId: id, sentAt: new Date() })
        .where(eq(emails.id, email.id));
    } catch (err) {
      await db
        .update(emails)
        .set({ status: "failed", error: err instanceof Error ? err.message : String(err) })
        .where(eq(emails.id, email.id));
    }
  }
}

export async function listInbox(db: Db, userId: string) {
  return db
    .select({
      id: emails.id,
      kind: emails.kind,
      subject: emails.subject,
      body: emails.body,
      status: emails.status,
      createdAt: emails.createdAt,
    })
    .from(emails)
    .where(eq(emails.userId, userId))
    .orderBy(desc(emails.createdAt))
    .limit(50);
}
