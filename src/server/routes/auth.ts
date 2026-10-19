import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "../db/schema";
import { notFound } from "../errors";
import { rateLimit, setSessionCookie, validate, type Env } from "../http";
import {
  createSession,
  deleteSession,
  logIn,
  requestPasswordReset,
  resetPassword,
  SESSION_COOKIE,
  signUp,
} from "../services/auth";
import { deliverEmails, queueEmails, templates } from "../services/email";
import { DEMO_ACCOUNTS } from "../seed";

const email = z.string().trim().max(200).pipe(z.email("Enter a valid email address."));

const signUpBody = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80, "That name is too long."),
  email,
  password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
});


const logInBody = z.object({ email, password: z.string().min(1, "Enter your password.").max(200) });

const LIMIT = { max: 10, windowMs: 10 * 60 * 1000 };

const newPassword = z.string().min(8, "Use at least 8 characters for your password.").max(200);

export const authRoutes = new Hono<Env>()
  .get("/me", (c) => c.json({ user: c.get("user") }))

  .post("/signup", validate("json", signUpBody), async (c) => {
    rateLimit(c, "signup", LIMIT);
    const { db } = c.get("deps");
    const user = await signUp(db, c.req.valid("json"));
    const session = await createSession(db, user.id, c.get("now"));
    setSessionCookie(c, session.token, session.expiresAt);
    return c.json({ user }, 201);
  })

  .post("/login", validate("json", logInBody), async (c) => {
    rateLimit(c, "login", LIMIT);
    const { db } = c.get("deps");
    const user = await logIn(db, c.req.valid("json"));
    const session = await createSession(db, user.id, c.get("now"));
    setSessionCookie(c, session.token, session.expiresAt);
    return c.json({ user }, 200);
  })

  // One-click sign in as one of the seeded demo accounts.
  .post("/demo", validate("json", z.object({ as: z.enum(["organizer", "attendee"]) })), async (c) => {
    const { db, demo } = c.get("deps");
    if (!demo) throw notFound("Sample accounts are only available in demo mode.");
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, DEMO_ACCOUNTS[c.req.valid("json").as].email));
    if (!user) throw notFound("The demo data isn't loaded yet. Try again in a minute.");
    const session = await createSession(db, user.id, c.get("now"));
    setSessionCookie(c, session.token, session.expiresAt);
    return c.json({ user }, 200);
  })

  // Same answer whether or not the email has an account. `emailEnabled` tells
  // the page whether a link can actually be delivered on this deployment.
  .post("/forgot", validate("json", z.object({ email })), async (c) => {
    rateLimit(c, "forgot", { max: 5, windowMs: 15 * 60 * 1000 });
    const { db, mailer, baseUrl, production } = c.get("deps");
    const request = await requestPasswordReset(db, c.req.valid("json").email, c.get("now"));
    if (request) {
      const url = `${baseUrl}/reset-password?token=${request.token}`;
      const ids = await queueEmails(db, [templates.passwordReset(request.user, url)]);
      await deliverEmails(db, mailer, ids);
      // Locally there's no email service, so print the link for testing.
      if (!mailer && !production) console.info(`Password reset link for ${request.user.email}: ${url}`);
    }
    return c.json({ ok: true, emailEnabled: !!mailer }, 200);
  })

  .post(
    "/reset",
    validate("json", z.object({ token: z.string().min(10).max(200), password: newPassword })),
    async (c) => {
      rateLimit(c, "reset", LIMIT);
      const { db } = c.get("deps");
      const { token, password } = c.req.valid("json");
      const user = await resetPassword(db, token, password, c.get("now"));
      const session = await createSession(db, user.id, c.get("now"));
      setSessionCookie(c, session.token, session.expiresAt);
      return c.json({ user }, 200);
    },
  )

  .post("/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await deleteSession(c.get("deps").db, token);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true }, 200);
  });
