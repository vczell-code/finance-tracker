import { createDb } from "./index";
import { seedIfNeeded } from "./seed";

const { db, sqlite } = createDb(process.env.DATABASE_PATH ?? "./data/finance.db");
seedIfNeeded(db);
sqlite.close();
console.log("Database migrated and seeded.");
