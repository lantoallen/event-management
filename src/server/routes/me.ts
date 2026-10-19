import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { z } from "zod";
import { conflict } from "../errors";
import { rateLimit, requireUser, setSessionCookie, ticketUrl, validate, type Env } from "../http";
import { changePassword, deleteAccount, updateName } from "../services/account";
import { SESSION_COOKIE } from "../services/auth";
import { ticketCalendar } from "../services/calendar";
import { deliverEmails, listInbox } from "../services/email";
import { getTicket, listMyTickets } from "../services/registrations";

export const meRoutes = new Hono<Env>()
  .get("/tickets", async (c) => {
    const user = requireUser(c);
    return c.json({ tickets: await listMyTickets(c.get("deps").db, user.id) }, 200);
  })

  .get("/tickets/:code", async (c) => {
    const user = requireUser(c);
    return c.json({ ticket: await getTicket(c.get("deps").db, c.req.param("code"), user.id) }, 200);
  })

  // An .ics file for Apple Calendar, Outlook, and anything else that opens them.
  .get("/tickets/:code/calendar", async (c) => {
    const user = requireUser(c);
    const ticket = await getTicket(c.get("deps").db, c.req.param("code"), user.id);
    if (ticket.status !== "confirmed" || ticket.event.status === "cancelled") {
      throw conflict("not_confirmed", "Only confirmed tickets can be added to a calendar.");
    }
    return c.body(ticketCalendar(ticket, c.get("deps").baseUrl, c.get("now")), 200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ticket.event.slug}.ics"`,
    });
  })

  .patch(
    "/profile",
    validate("json", z.object({ name: z.string().trim().min(2, "Enter your name.").max(80, "That name is too long.") })),
    async (c) => {
      const user = requireUser(c);
      const { db, demo } = c.get("deps");
      return c.json({ user: await updateName(db, user, c.req.valid("json").name, { demo: !!demo }) }, 200);
    },
  )

  .post(
    "/password",
    validate(
      "json",
      z.object({
        current: z.string().max(200).optional(),
        next: z.string().min(8, "Use at least 8 characters for your new password.").max(200),
      }),
    ),
    async (c) => {
      rateLimit(c, "password", { max: 10, windowMs: 10 * 60 * 1000 });
      const user = requireUser(c);
      const { db, demo } = c.get("deps");
      const session = await changePassword(db, user, c.req.valid("json"), { demo: !!demo, now: c.get("now") });
      setSessionCookie(c, session.token, session.expiresAt);
      return c.json({ ok: true }, 200);
    },
  )

  .delete("/", validate("json", z.object({ password: z.string().max(200).optional() })), async (c) => {
    rateLimit(c, "delete-account", { max: 10, windowMs: 10 * 60 * 1000 });
    const user = requireUser(c);
    const { db, mailer, demo } = c.get("deps");
    const { emailIds } = await deleteAccount(db, user, c.req.valid("json").password, {
      demo: !!demo,
      now: c.get("now"),
      ticketUrl: ticketUrl(c),
    });
    await deliverEmails(db, mailer, emailIds);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true }, 200);
  })

  .get("/inbox", async (c) => {
    const user = requireUser(c);
    return c.json({ emails: await listInbox(c.get("deps").db, user.id) }, 200);
  });
