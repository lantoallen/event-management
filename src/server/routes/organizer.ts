import { Hono } from "hono";
import { z } from "zod";
import { categories } from "../db/schema";
import { requireUser, ticketUrl, validate, type Env } from "../http";
import { deliverEmails } from "../services/email";
import {
  cancelEvent,
  createEvent,
  deleteDraft,
  duplicateEvent,
  getOwnedEvent,
  listOrganizerEvents,
  publishEvent,
  updateEvent,
} from "../services/events";
import { listAnnouncements, sendAnnouncement } from "../services/announcements";
import { attendeesCsv, checkIn, eventStats, listAttendees, recentCheckIns, undoCheckIn } from "../services/organizer";

const date = (label: string) =>
  z.iso.datetime({ offset: true, error: `Pick a valid ${label}.` }).transform((s) => new Date(s));

const eventBody = z.object({
  title: z.string().trim().min(3, "Give the event a title.").max(120, "Keep the title under 120 characters."),
  summary: z
    .string()
    .trim()
    .min(10, "Add a one-line summary (at least 10 characters).")
    .max(200, "Keep the summary under 200 characters."),
  description: z
    .string()
    .trim()
    .min(20, "Add a description of at least 20 characters.")
    .max(5000, "Keep the description under 5,000 characters."),
  category: z.enum(categories, "Pick a category."),
  startsAt: date("start time"),
  endsAt: date("end time"),
  isOnline: z.boolean(),
  visibility: z.enum(["public", "unlisted"]).default("public"),
  location: z.string().trim().min(2, "Add a location or meeting link.").max(300),
  city: z.string().trim().max(80).default(""),
  capacity: z
    .number("Enter how many people can come.")
    .int("Capacity has to be a whole number.")
    .min(1, "Capacity has to be at least 1.")
    .max(5000, "Capacity can't be more than 5,000."),
});

const newEventBody = eventBody
  .extend({ publish: z.boolean().default(false) })
  .refine((e) => e.isOnline || e.city.length >= 2, { message: "Add the city.", path: ["city"] });
const editEventBody = eventBody.refine((e) => e.isOnline || e.city.length >= 2, {
  message: "Add the city.",
  path: ["city"],
});

const idParam = z.object({ id: z.uuid("We couldn't find that event.") });

export const organizerRoutes = new Hono<Env>()
  .get("/events", async (c) => {
    const user = requireUser(c);
    return c.json({ events: await listOrganizerEvents(c.get("deps").db, user.id, c.get("now")) }, 200);
  })

  .post("/events", validate("json", newEventBody), async (c) => {
    const user = requireUser(c);
    const event = await createEvent(c.get("deps").db, user.id, c.req.valid("json"), c.get("now"));
    return c.json({ event }, 201);
  })

  .get("/events/:id", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    return c.json({ event: await getOwnedEvent(c.get("deps").db, c.req.valid("param").id, user.id) }, 200);
  })

  .patch("/events/:id", validate("param", idParam), validate("json", editEventBody), async (c) => {
    const user = requireUser(c);
    const { db, mailer } = c.get("deps");
    const { event, emailIds } = await updateEvent(db, {
      eventId: c.req.valid("param").id,
      organizerId: user.id,
      input: c.req.valid("json"),
      now: c.get("now"),
      ticketUrl: ticketUrl(c),
    });
    await deliverEmails(db, mailer, emailIds);
    return c.json({ event }, 200);
  })

  .post("/events/:id/publish", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    const event = await publishEvent(c.get("deps").db, c.req.valid("param").id, user.id, c.get("now"));
    return c.json({ event }, 200);
  })

  .post("/events/:id/cancel", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    const { db, mailer } = c.get("deps");
    const { event, emailIds } = await cancelEvent(db, c.req.valid("param").id, user.id, c.get("now"));
    await deliverEmails(db, mailer, emailIds);
    return c.json({ event }, 200);
  })

  .post("/events/:id/duplicate", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    const event = await duplicateEvent(c.get("deps").db, c.req.valid("param").id, user.id, c.get("now"));
    return c.json({ event }, 201);
  })

  .delete("/events/:id", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    await deleteDraft(c.get("deps").db, c.req.valid("param").id, user.id);
    return c.json({ ok: true }, 200);
  })

  .get("/events/:id/stats", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    const stats = await eventStats(c.get("deps").db, c.req.valid("param").id, user.id, c.get("now"));
    return c.json({ stats }, 200);
  })

  .get("/events/:id/attendees", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    return c.json({ attendees: await listAttendees(c.get("deps").db, c.req.valid("param").id, user.id) }, 200);
  })

  .get("/events/:id/attendees/export", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    const { db } = c.get("deps");
    const { id } = c.req.valid("param");
    const event = await getOwnedEvent(db, id, user.id);
    const csv = await attendeesCsv(db, id, user.id);
    // The BOM makes Excel open the file as UTF-8, so names like Batangueño survive.
    return c.body(`﻿${csv}`, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-attendees.csv"`,
    });
  })

  .get("/events/:id/announcements", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    const messages = await listAnnouncements(c.get("deps").db, c.req.valid("param").id, user.id);
    return c.json({ messages }, 200);
  })

  .post(
    "/events/:id/announcements",
    validate("param", idParam),
    validate(
      "json",
      z.object({
        subject: z.string().trim().min(3, "Add a short subject.").max(120, "Keep the subject under 120 characters."),
        body: z.string().trim().min(10, "Write a message of at least 10 characters.").max(5000, "Keep the message under 5,000 characters."),
        includeWaitlist: z.boolean().default(false),
      }),
    ),
    async (c) => {
      const user = requireUser(c);
      const { db, mailer, baseUrl } = c.get("deps");
      const { announcement, emailIds } = await sendAnnouncement(db, {
        eventId: c.req.valid("param").id,
        organizer: user,
        ...c.req.valid("json"),
        now: c.get("now"),
        eventUrl: (slug) => `${baseUrl}/events/${slug}`,
      });
      await deliverEmails(db, mailer, emailIds);
      return c.json({ message: announcement }, 201);
    },
  )

  .get("/events/:id/check-ins", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    return c.json({ recent: await recentCheckIns(c.get("deps").db, c.req.valid("param").id, user.id) }, 200);
  })

  .post(
    "/events/:id/check-ins",
    validate("param", idParam),
    validate("json", z.object({ code: z.string().trim().min(1, "Scan a ticket or type its code.").max(300) })),
    async (c) => {
      const user = requireUser(c);
      const result = await checkIn(c.get("deps").db, {
        eventId: c.req.valid("param").id,
        organizerId: user.id,
        code: c.req.valid("json").code,
        now: c.get("now"),
      });
      return c.json(result, 200);
    },
  )

  .delete(
    "/events/:id/check-ins/:code",
    validate("param", idParam.extend({ code: z.string().min(1).max(40) })),
    async (c) => {
      const user = requireUser(c);
      const { id, code } = c.req.valid("param");
      await undoCheckIn(c.get("deps").db, { eventId: id, organizerId: user.id, code });
      return c.json({ ok: true }, 200);
    },
  );
