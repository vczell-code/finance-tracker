import { asc, count, eq } from "drizzle-orm";
import type { z } from "zod";
import type { DB } from "@/db";
import { categories, recurringRules, transactions, type Category } from "@/db/schema";
import type { categoryCreateSchema, categoryUpdateSchema } from "@/lib/validation";

export function listCategories(db: DB, includeArchived = false): Category[] {
  const q = db.select().from(categories);
  const rows = includeArchived ? q.all() : q.where(eq(categories.isArchived, false)).all();
  return rows.sort(
    (a, b) => a.type.localeCompare(b.type) || a.groupName.localeCompare(b.groupName) || a.name.localeCompare(b.name),
  );
}

export function getCategory(db: DB, id: number): Category | undefined {
  return db.select().from(categories).where(eq(categories.id, id)).get();
}

export function createCategory(db: DB, input: z.infer<typeof categoryCreateSchema>): Category {
  return db
    .insert(categories)
    .values({ ...input, monthlyBudgetCents: input.monthlyBudgetCents ?? null })
    .returning()
    .get();
}

export function updateCategory(db: DB, id: number, input: z.infer<typeof categoryUpdateSchema>): Category | undefined {
  if (Object.keys(input).length === 0) return getCategory(db, id);
  return db.update(categories).set(input).where(eq(categories.id, id)).returning().get();
}

export type DeleteCategoryResult = { ok: true } | { ok: false; reason: "not_found" | "in_use"; references?: number };

/** Hard delete only if nothing references the category; otherwise caller should suggest archiving. */
export function deleteCategory(db: DB, id: number): DeleteCategoryResult {
  if (!getCategory(db, id)) return { ok: false, reason: "not_found" };
  const [{ t }] = db.select({ t: count() }).from(transactions).where(eq(transactions.categoryId, id)).all();
  const [{ r }] = db.select({ r: count() }).from(recurringRules).where(eq(recurringRules.categoryId, id)).all();
  if (t + r > 0) return { ok: false, reason: "in_use", references: t + r };
  db.delete(categories).where(eq(categories.id, id)).run();
  return { ok: true };
}

export function findCategoryByName(db: DB, name: string): Category | undefined {
  const lower = name.trim().toLowerCase();
  return db
    .select()
    .from(categories)
    .orderBy(asc(categories.isArchived))
    .all()
    .find((c) => c.name.toLowerCase() === lower);
}
