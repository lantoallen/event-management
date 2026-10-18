// npm run db:setup   apply migrations, and load sample data if the database is empty
// npm run db:reset   wipe everything and load the sample data again
//
// Uses DATABASE_URL when it's set, otherwise the local PGlite folder. On Vercel
// without DATABASE_URL it does nothing, since the app runs an in-memory database.
// Stop `npm run dev` first when using PGlite, since only one process can open it.
import { SITE_URL } from "@/lib/config";
import { isDemoMemoryMode, openFromEnv } from "@/server/db/client";
import { isEmpty, resetDatabase, seed } from "@/server/seed";

// Wrapped in a function because tsx runs this file as CommonJS, which has no top-level await.
async function main() {
  const command = process.argv[2];
  if (isDemoMemoryMode()) {
    console.log("No DATABASE_URL, so the deployed app will use an in-memory demo database. Nothing to set up.");
    return;
  }
  const handle = await openFromEnv({ migrate: true });
  console.log(`Connected to ${handle.kind === "postgres" ? "Postgres" : "local PGlite"}, migrations applied.`);

  if (command === "reset") {
    await resetDatabase(handle.db);
    console.log("Seeded:", await seed(handle.db, new Date(), SITE_URL));
  } else if (await isEmpty(handle.db)) {
    console.log("Seeded:", await seed(handle.db, new Date(), SITE_URL));
  } else {
    console.log("Database already has data, leaving it alone.");
  }
  await handle.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
