import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { seedIfNeeded } from "./seed";

export type DB = BetterSQLite3Database<typeof schema>;

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

/** Open a SQLite connection with the required pragmas and apply migrations. */
export function createDb(filePath: string): { db: DB; sqlite: Database.Database } {
  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  }
  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, sqlite };
}

const globalForDb = globalThis as unknown as { __financeDb?: DB };

/** Lazily-initialised singleton (survives dev hot reloads). */
export function getDb(): DB {
  if (!globalForDb.__financeDb) {
    const { db } = createDb(process.env.DATABASE_PATH ?? "./data/finance.db");
    seedIfNeeded(db);
    globalForDb.__financeDb = db;
  }
  return globalForDb.__financeDb;
}
