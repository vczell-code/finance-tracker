import { createDb, type DB } from "@/db";
import { categories } from "@/db/schema";
import { seedIfNeeded } from "@/db/seed";

/** Fresh in-memory SQLite database with migrations applied and default seed data. */
export function createTestDb(): DB {
  const { db } = createDb(":memory:");
  seedIfNeeded(db);
  return db;
}

export function categoryId(db: DB, name: string): number {
  const c = db.select().from(categories).all().find((x) => x.name === name);
  if (!c) throw new Error(`Category ${name} not found`);
  return c.id;
}
