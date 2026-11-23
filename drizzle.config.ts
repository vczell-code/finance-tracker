import { defineConfig } from "drizzle-kit";
import { databasePath, loadLocalEnv } from "./src/db/config";

loadLocalEnv();

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databasePath(),
  },
});
