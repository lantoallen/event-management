import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type DbHandle = { db: Db; close: () => Promise<void>; kind: "postgres" | "pglite" };

const migrationsFolder = path.join(process.cwd(), "drizzle");

// Neon's connection strings include `channel_binding=require`. postgres.js
// doesn't know that option and passes it to the server as a setting, which
// the server rejects, so it's dropped. sslmode stays and still turns on TLS.
export function cleanConnectionString(url: string) {
  const parsed = new URL(url);
  parsed.searchParams.delete("channel_binding");
  return parsed.toString();
}

// Real Postgres (Neon in production). `prepare: false` keeps it working
// behind Neon's pooled connection string, which doesn't support prepared statements.
export async function openPostgres(url: string, { migrate = false } = {}): Promise<DbHandle> {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = postgres(cleanConnectionString(url), { prepare: false, max: 5, onnotice: () => {} });
  const db = drizzle(client, { schema });
  if (migrate) {
    const { migrate: run } = await import("drizzle-orm/postgres-js/migrator");
    await run(db, { migrationsFolder });
  }
  return { db, close: () => client.end(), kind: "postgres" };
}

// Postgres compiled to WebAssembly. Used for local development and tests so
// nobody has to install a database. Leave out `dataDir` for an in-memory one.
export async function openPglite(dataDir?: string): Promise<DbHandle> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dataDir) await mkdir(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db: db as unknown as Db, close: () => client.close(), kind: "pglite" };
}

export const localDataDir = path.join(process.cwd(), ".data", "pglite");

export function openFromEnv({ migrate = false } = {}) {
  const url = process.env.DATABASE_URL;
  // Serverless file systems are read-only, so PGlite can't work there.
  if (!url && process.env.VERCEL) throw new Error("DATABASE_URL isn't set. Add your Postgres connection string in Vercel.");
  return url ? openPostgres(url, { migrate }) : openPglite(localDataDir);
}
