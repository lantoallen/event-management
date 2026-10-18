import { Hono } from "hono";
import { conflict } from "../errors";
import { requireUser, type Env } from "../http";
import { ticketCalendar } from "../services/calendar";
import { listInbox } from "../services/email";
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

  .get("/inbox", async (c) => {
    const user = requireUser(c);
    return c.json({ emails: await listInbox(c.get("deps").db, user.id) }, 200);
  });
