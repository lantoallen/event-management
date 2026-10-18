import { SITE_URL } from "@/lib/config";
import { createApp, type App } from "./app";
import { openFromEnv, type DbHandle } from "./db/client";
import { mailerFromEnv } from "./services/email";
import { isEmpty, seed } from "./seed";

// The database lives on globalThis so hot reloads in development reuse it.
// PGlite can only have one process holding its data folder.
const store = globalThis as unknown as { __eventsDb?: Promise<DbHandle> };

function getDb() {
  store.__eventsDb ??= (async () => {
    const handle = await openFromEnv();
    // Fresh local database: load the sample data so the app isn't empty.
    if (handle.kind === "pglite" && (await isEmpty(handle.db))) await seed(handle.db, new Date(), SITE_URL);
    return handle;
  })().catch((err) => {
    store.__eventsDb = undefined;
    throw err;
  });
  return store.__eventsDb;
}

let app: Promise<App> | undefined;

export function getApp() {
  app ??= getDb().then(({ db }) =>
    createApp({
      db,
      mailer: mailerFromEnv(),
      baseUrl: SITE_URL,
      cronSecret: process.env.CRON_SECRET,
      production: process.env.NODE_ENV === "production",
    }),
  );
  return app;
}
