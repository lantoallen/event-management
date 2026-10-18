import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Always stored lowercased so lookups don't depend on how someone typed it.
  email: text("email").notNull().unique(),
  // Null for seeded people who never sign in.
  passwordHash: text("password_hash"),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the cookie value, so a leaked table can't be used to log in.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const eventCategory = pgEnum("event_category", [
  "tech",
  "music",
  "sports",
  "food",
  "arts",
  "community",
  "business",
  "education",
]);

export const eventStatus = pgEnum("event_status", ["draft", "published", "cancelled"]);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull(),
    category: eventCategory("category").notNull(),
    status: eventStatus("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    isOnline: boolean("is_online").notNull().default(false),
    // Venue name and address, or the meeting link for online events.
    location: text("location").notNull(),
    city: text("city").notNull(),
    capacity: integer("capacity").notNull(),
    ...timestamps,
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    index("events_status_starts_idx").on(t.status, t.startsAt),
    index("events_organizer_idx").on(t.organizerId),
    check("events_capacity_positive", sql`${t.capacity} > 0`),
    check("events_ends_after_start", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const registrationStatus = pgEnum("registration_status", [
  "confirmed",
  "waitlisted",
  "cancelled",
]);

// Strict order for the waitlist. Timestamps can tie when people sign up at
// the same moment; a sequence can't.
export const registrationQueue = pgSequence("registration_queue_seq");

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: registrationStatus("status").notNull(),
    ticketCode: text("ticket_code").notNull().unique(),
    queueNo: bigint("queue_no", { mode: "number" })
      .notNull()
      .default(sql`nextval('registration_queue_seq')`),
    // When this person (re)joined.
    ...timestamps,
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  },
  (t) => [
    unique("registrations_event_user_key").on(t.eventId, t.userId),
    index("registrations_event_status_idx").on(t.eventId, t.status, t.queueNo),
    index("registrations_user_idx").on(t.userId),
  ],
);

export const emailStatus = pgEnum("email_status", ["logged", "sent", "failed"]);

// Every email the app would send. The demo inbox reads from here, and when a
// Resend key is set the same rows record what was actually delivered.
export const emails = pgTable(
  "emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    toEmail: text("to_email").notNull(),
    kind: text("kind").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: emailStatus("status").notNull().default("logged"),
    providerId: text("provider_id"),
    error: text("error"),
    ...timestamps,
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("emails_user_created_idx").on(t.userId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type EventCategory = (typeof eventCategory.enumValues)[number];
export const categories = eventCategory.enumValues;
