import { Hono } from "hono";
import { z } from "zod";
import { categories } from "../db/schema";
import { requireUser, ticketUrl, validate, type Env } from "../http";
import { deliverEmails } from "../services/email";
import { eventDays, eventsOverview, getEventPage, listPublicEvents } from "../services/events";
import { cancelRegistration, register } from "../services/registrations";

const listQuery = z.object({
  q: z.string().max(100).optional(),
  category: z.enum(categories).optional().catch(undefined),
  when: z.enum(["all", "today", "week", "weekend", "month"]).optional().catch(undefined),
  day: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(100).optional().catch(undefined),
});

const daysQuery = listQuery.pick({ q: true, category: true });

const idParam = z.object({ id: z.uuid("We couldn't find that event.") });

export const eventRoutes = new Hono<Env>()
  .get("/", validate("query", listQuery), async (c) => {
    const result = await listPublicEvents(c.get("deps").db, c.req.valid("query"), c.get("now"));
    return c.json(result, 200);
  })

  .get("/overview", async (c) => {
    return c.json(await eventsOverview(c.get("deps").db, c.get("now")), 200);
  })

  .get("/days", validate("query", daysQuery), async (c) => {
    return c.json(await eventDays(c.get("deps").db, c.req.valid("query"), c.get("now")), 200);
  })

  .get("/:slug", async (c) => {
    const event = await getEventPage(c.get("deps").db, c.req.param("slug"), c.get("user")?.id ?? null, c.get("now"));
    return c.json({ event }, 200);
  })

  .post("/:id/registrations", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    const { db, mailer } = c.get("deps");
    const { registration, emailIds } = await register(db, c.req.valid("param").id, user, {
      now: c.get("now"),
      ticketUrl: ticketUrl(c),
    });
    await deliverEmails(db, mailer, emailIds);
    return c.json({ registration }, 201);
  })

  .delete("/:id/registrations/me", validate("param", idParam), async (c) => {
    const user = requireUser(c);
    const { db, mailer } = c.get("deps");
    const { emailIds } = await cancelRegistration(db, c.req.valid("param").id, user, {
      now: c.get("now"),
      ticketUrl: ticketUrl(c),
    });
    await deliverEmails(db, mailer, emailIds);
    return c.json({ ok: true }, 200);
  });
