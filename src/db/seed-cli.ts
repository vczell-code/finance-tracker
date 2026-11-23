import { databasePath, loadLocalEnv } from "./config";
import { createDb } from "./index";
import { seedIfNeeded } from "./seed";

loadLocalEnv();
const { db, sqlite } = createDb(databasePath());
seedIfNeeded(db);
sqlite.close();
console.log("Database migrated and seeded.");
