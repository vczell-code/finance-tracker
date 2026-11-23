import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { databasePath, loadLocalEnv } from "./config";

/**
 * Consistent snapshot of the live database (SQLite online backup API — safe while the app runs).
 * Writes to BACKUP_DIR or <database folder>/backups.
 */
async function main() {
  loadLocalEnv();
  const source = path.resolve(databasePath());
  if (!fs.existsSync(source)) throw new Error(`Database not found: ${source}`);

  const dir = path.resolve(process.env.BACKUP_DIR || path.join(path.dirname(source), "backups"));
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
  const target = path.join(dir, `finance-${stamp}.db`);

  const sqlite = new Database(source, { fileMustExist: true });
  try {
    await sqlite.backup(target);
  } finally {
    sqlite.close();
  }
  console.log(`Backup written to ${target}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
