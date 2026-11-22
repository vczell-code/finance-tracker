import { and, count, desc, eq, gte, lte, or, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import { categories, transactions, type Transaction } from "@/db/schema";
import type { TransactionCreateInput, TransactionQuery, TransactionUpdateInput } from "@/lib/validation";
import { getSettings } from "./settings.service";

export type TransactionWithCategory = Transaction & {
  category: { id: number; name: string; color: string; icon: string; isFixed: boolean } | null;
};

function buildFilters(q: Partial<TransactionQuery>): SQL | undefined {
  const conds: SQL[] = [];
  if (q.startDate) conds.push(gte(transactions.date, q.startDate));
  if (q.endDate) conds.push(lte(transactions.date, q.endDate));
  if (q.type) conds.push(eq(transactions.type, q.type));
  if (q.categoryId) conds.push(eq(transactions.categoryId, q.categoryId));
  if (q.paymentMethod) conds.push(eq(transactions.paymentMethod, q.paymentMethod));
  if (q.search) {
    const pattern = `%${q.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const s = or(
      sql`${transactions.merchant} LIKE ${pattern} ESCAPE '\\'`,
      sql`${transactions.notes} LIKE ${pattern} ESCAPE '\\'`,
    );
    if (s) conds.push(s);
  }
  return conds.length ? and(...conds) : undefined;
}

export function listTransactions(
  db: DB,
  q: Partial<TransactionQuery> & { limit: number; offset: number },
): { items: TransactionWithCategory[]; total: number } {
  const where = buildFilters(q);
  const rows = db
    .select({ tx: transactions, category: categories })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(where)
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(q.limit)
    .offset(q.offset)
    .all();
  const [{ total }] = db.select({ total: count() }).from(transactions).where(where).all();
  return {
    items: rows.map(({ tx, category }) => ({
      ...tx,
      category: category
        ? { id: category.id, name: category.name, color: category.color, icon: category.icon, isFixed: category.isFixed }
        : null,
    })),
    total,
  };
}

export function getTransaction(db: DB, id: number): Transaction | undefined {
  return db.select().from(transactions).where(eq(transactions.id, id)).get();
}

export function createTransaction(db: DB, input: TransactionCreateInput): Transaction {
  const { baseCurrency } = getSettings(db);
  return db
    .insert(transactions)
    .values({
      ...input,
      categoryId: input.type === "TRANSFER" ? (input.categoryId ?? null) : input.categoryId,
      currency: input.currency ?? baseCurrency,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
}

/** Returns undefined if not found; throws Error with `.status = 400` if result would be invalid. */
export function updateTransaction(db: DB, id: number, input: TransactionUpdateInput): Transaction | undefined {
  const existing = getTransaction(db, id);
  if (!existing) return undefined;
  const merged = { ...existing, ...input };
  if (merged.type !== "TRANSFER" && !merged.categoryId) {
    throw Object.assign(new Error("Category is required for income and expenses"), { status: 400 });
  }
  if (Object.keys(input).length === 0) return existing;
  return db.update(transactions).set(input).where(eq(transactions.id, id)).returning().get();
}

export function deleteTransaction(db: DB, id: number): boolean {
  return db.delete(transactions).where(eq(transactions.id, id)).run().changes > 0;
}
