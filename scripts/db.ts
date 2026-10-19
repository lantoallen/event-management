// npm run db:setup   apply migrations, and load sample data if the database is empty
// npm run db:reset   wipe everything and load the sample data again
//
// Uses DATABASE_URL when it's set, otherwise the local PGlite folder. On Vercel
// without DATABASE_URL it saves a snapshot for the in-memory demo database.
// Stop `npm run dev` first when using PGlite, since only one process can open it.
import { DEMO_MODE, SITE_URL } from "@/lib/config";
import { isDemoMemoryMode, openFromEnv, saveDemoSnapshot } from "@/server/db/client";
import { isEmpty, resetDatabase, seed } from "@/server/seed";

// Wrapped in a function because tsx runs this file as CommonJS, which has no top-level await.
async function main() {
  const command = process.argv[2];
  if (isDemoMemoryMode()) {
    const saved = await saveDemoSnapshot();
    console.log(`No DATABASE_URL, so the app will run an in-memory demo database. Saved a migrated snapshot (${Math.round(saved.bytes / 1024)} KB) for it to start from.`);
    return;
  }
  const handle = await openFromEnv({ migrate: true });
  console.log(`Connected to ${handle.kind === "postgres" ? "Postgres" : "local PGlite"}, migrations applied.`);

  if (!DEMO_MODE) {
    // A real deployment only gets its tables; sample data never goes in.
    if (command === "reset") console.log("Refusing to reset: DEMO_MODE isn't on, so this could be real data.");
  } else if (command === "reset") {
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
