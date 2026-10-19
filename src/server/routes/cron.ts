import { Hono, type Context } from "hono";
import { notFound, unauthorized } from "../errors";
import { ticketUrl, type Env } from "../http";
import { deliverEmails } from "../services/email";
import { queueReminders } from "../services/reminders";
import { resetDatabase, seed } from "../seed";

// Vercel Cron calls these with `Authorization: Bearer $CRON_SECRET`.
function checkCronSecret(c: Context<Env>) {
  const { cronSecret, production } = c.get("deps");
  if (!cronSecret && !production) return;
  if (!cronSecret || c.req.header("authorization") !== `Bearer ${cronSecret}`) throw unauthorized("Bad cron secret.");
}

export const cronRoutes = new Hono<Env>()
  .get("/reminders", async (c) => {
    checkCronSecret(c);
    const { db, mailer } = c.get("deps");
    const ids = await queueReminders(db, c.get("now"), ticketUrl(c));
    await deliverEmails(db, mailer, ids);
    return c.json({ queued: ids.length }, 200);
  })

  // Wipes everything and loads the sample data again, once a day.
  .get("/reset-demo", async (c) => {
    checkCronSecret(c);
    const { db, baseUrl, demo } = c.get("deps");
    // Never wipe a real deployment, whatever calls this.
    if (!demo) throw notFound("Not in demo mode.");
    await resetDatabase(db);
    return c.json({ seeded: await seed(db, c.get("now"), baseUrl) }, 200);
  });
