import { Hono } from "hono";
import { requireUser, type Env } from "../http";
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

  .get("/inbox", async (c) => {
    const user = requireUser(c);
    return c.json({ emails: await listInbox(c.get("deps").db, user.id) }, 200);
  });
