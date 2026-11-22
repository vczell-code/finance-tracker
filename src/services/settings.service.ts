import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { settings, type Settings } from "@/db/schema";

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  baseCurrency: "EUR",
  monthStartDay: 1,
  updatedAt: new Date(0).toISOString(),
};

export function getSettings(db: DB): Settings {
  return db.select().from(settings).where(eq(settings.id, 1)).get() ?? DEFAULT_SETTINGS;
}

export function updateSettings(
  db: DB,
  patch: { baseCurrency?: string; monthStartDay?: number },
): Settings {
  const current = getSettings(db);
  const next = {
    id: 1,
    baseCurrency: patch.baseCurrency ?? current.baseCurrency,
    monthStartDay: patch.monthStartDay ?? current.monthStartDay,
    updatedAt: new Date().toISOString(),
  };
  return db
    .insert(settings)
    .values(next)
    .onConflictDoUpdate({ target: settings.id, set: next })
    .returning()
    .get();
}
