import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { AppError } from "./errors";
import type { Deps, Env } from "./http";
import { authRoutes } from "./routes/auth";
import { cronRoutes } from "./routes/cron";
import { eventRoutes } from "./routes/events";
import { meRoutes } from "./routes/me";
import { organizerRoutes } from "./routes/organizer";
import { getSessionUser, SESSION_COOKIE } from "./services/auth";

export function createApp(deps: Deps) {
  const app = new Hono<Env>()
    .basePath("/api")
    // Blocks cross-site form posts. Our routes only take JSON, which browsers
    // can't send cross-site without CORS, so this is the second layer.
    .use(csrf())
    .use(async (c, next) => {
      const now = deps.now?.() ?? new Date();
      const token = getCookie(c, SESSION_COOKIE);
      c.set("deps", deps);
      c.set("now", now);
      c.set("user", token ? await getSessionUser(deps.db, token, now) : null);
      await next();
    })
    .get("/health", (c) => c.json({ ok: true }, 200))
    .route("/auth", authRoutes)
    .route("/events", eventRoutes)
    .route("/organizer", organizerRoutes)
    .route("/me", meRoutes)
    .route("/cron", cronRoutes);

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: { code: err.code, message: err.message } }, err.status);
    }
    if (err instanceof HTTPException) return err.getResponse();
    console.error(err);
    return c.json({ error: { code: "server_error", message: "Something went wrong on our side." } }, 500);
  });
  app.notFound((c) => c.json({ error: { code: "not_found", message: "No such endpoint." } }, 404));

  return app;
}

export type App = ReturnType<typeof createApp>;
