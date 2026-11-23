/**
 * Where the SQLite database lives. Set DATABASE_PATH in .env.local (gitignored) to keep it
 * outside the repo — e.g. outside a OneDrive-synced folder, since syncing a live SQLite file
 * can corrupt it.
 *
 * Next.js loads .env.local itself; standalone scripts (seed, backup, drizzle-kit) call
 * loadLocalEnv() first so they resolve the same path.
 */
export const DEFAULT_DATABASE_PATH = "./data/finance.db";

export function loadLocalEnv(): void {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // no .env.local — fall back to the default path
  }
}

export function databasePath(): string {
  return process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH;
}
