import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { openPglite } from "../db/client";

// Boots one in-memory Postgres, runs the migrations, and saves it as a
// snapshot. Each test file then starts from a copy, which skips the slow
// part of booting (initdb) instead of doing it once per file at the same time.
export default async function setup() {
  if (process.env.TEST_DATABASE_URL) return;
  const handle = await openPglite();
  const dump = await handle.dump!();
  await handle.close();
  const file = path.join(tmpdir(), `events-app-test-db-${process.pid}.tar.gz`);
  await writeFile(file, Buffer.from(await dump.arrayBuffer()));
  process.env.PGLITE_TEST_SNAPSHOT = file;
  return () => rm(file, { force: true });
}
