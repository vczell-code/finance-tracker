import { and, asc, eq, lte } from "drizzle-orm";
import type { DB } from "@/db";
import { categories, recurringRules, transactions, type Frequency, type RecurringRule } from "@/db/schema";
import { addDays, addMonthsClamped, parseISODate } from "@/lib/dates";
import type { RecurringCreateInput, RecurringUpdateInput } from "@/lib/validation";
import { getSettings } from "./settings.service";

const MAX_ITERATIONS_PER_RULE = 60;

/** Next due date after `currentDate` for the given frequency, clamped to anchorDay. */
export function advanceDueDate(currentDate: string, frequency: Frequency, anchorDay: number): string {
  switch (frequency) {
    case "WEEKLY":
      return addDays(currentDate, 7);
    case "MONTHLY":
      return addMonthsClamped(currentDate, 1, anchorDay);
    case "QUARTERLY":
      return addMonthsClamped(currentDate, 3, anchorDay);
    case "YEARLY":
      return addMonthsClamped(currentDate, 12, anchorDay);
  }
}

/** Monthly-normalised cost of a rule in cents (not rounded). */
export function monthlyNormalizedCents(rule: Pick<RecurringRule, "amountCents" | "frequency">): number {
  switch (rule.frequency) {
    case "WEEKLY":
      return (rule.amountCents * 52) / 12;
    case "MONTHLY":
      return rule.amountCents;
    case "QUARTERLY":
      return rule.amountCents / 3;
    case "YEARLY":
      return rule.amountCents / 12;
  }
}

/**
 * Generates any due transactions for active rules up to and including `asOfDate`.
 * Idempotent: the partial unique index on (recurringRuleId, date) plus
 * ON CONFLICT DO NOTHING guarantees no duplicates even if called repeatedly.
 */
export function syncRecurringTransactions(
  db: DB,
  asOfDate: string,
): { generatedCount: number; rulesProcessed: number } {
  const dueRules = db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.isActive, true), lte(recurringRules.nextDueDate, asOfDate)))
    .all();

  let generatedCount = 0;
  let rulesProcessed = 0;

  for (const rule of dueRules) {
    db.transaction((tx) => {
      let nextDueDate = rule.nextDueDate;
      let lastGeneratedDate = rule.lastGeneratedDate;
      let iterations = 0;

      while (nextDueDate <= asOfDate && iterations < MAX_ITERATIONS_PER_RULE) {
        // Bare ON CONFLICT DO NOTHING covers uidx_transactions_recurring_date.
        const result = tx
          .insert(transactions)
          .values({
            date: nextDueDate,
            amountCents: rule.amountCents,
            currency: rule.currency,
            type: rule.type,
            categoryId: rule.categoryId,
            merchant: rule.name,
            paymentMethod: rule.paymentMethod,
            notes: rule.notes,
            recurringRuleId: rule.id,
            createdAt: new Date().toISOString(),
          })
          .onConflictDoNothing()
          .run();
        generatedCount += result.changes;
        lastGeneratedDate = nextDueDate;
        nextDueDate = advanceDueDate(nextDueDate, rule.frequency, rule.anchorDay);
        iterations++;
      }

      tx.update(recurringRules)
        .set({ nextDueDate, lastGeneratedDate })
        .where(eq(recurringRules.id, rule.id))
        .run();
    });
    rulesProcessed++;
  }

  return { generatedCount, rulesProcessed };
}

export type RecurringRuleWithCategory = RecurringRule & {
  category: { id: number; name: string; color: string; icon: string; groupName: string } | null;
  monthlyCents: number;
};

export function listRecurringRules(db: DB): {
  rules: RecurringRuleWithCategory[];
  monthlyFixedExpenseCents: number;
  monthlyFixedIncomeCents: number;
} {
  const rows = db
    .select({ rule: recurringRules, category: categories })
    .from(recurringRules)
    .leftJoin(categories, eq(recurringRules.categoryId, categories.id))
    .orderBy(asc(recurringRules.nextDueDate))
    .all();

  let monthlyFixedExpenseCents = 0;
  let monthlyFixedIncomeCents = 0;
  const rules = rows.map(({ rule, category }) => {
    const monthlyCents = monthlyNormalizedCents(rule);
    if (rule.isActive) {
      if (rule.type === "EXPENSE") monthlyFixedExpenseCents += monthlyCents;
      else monthlyFixedIncomeCents += monthlyCents;
    }
    return {
      ...rule,
      monthlyCents,
      category: category
        ? { id: category.id, name: category.name, color: category.color, icon: category.icon, groupName: category.groupName }
        : null,
    };
  });

  return {
    rules,
    monthlyFixedExpenseCents: Math.round(monthlyFixedExpenseCents),
    monthlyFixedIncomeCents: Math.round(monthlyFixedIncomeCents),
  };
}

export function getRecurringRule(db: DB, id: number): RecurringRule | undefined {
  return db.select().from(recurringRules).where(eq(recurringRules.id, id)).get();
}

export function createRecurringRule(db: DB, input: RecurringCreateInput): RecurringRule {
  const { baseCurrency } = getSettings(db);
  return db
    .insert(recurringRules)
    .values({
      ...input,
      currency: input.currency ?? baseCurrency,
      anchorDay: parseISODate(input.nextDueDate).d,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
}

export function updateRecurringRule(db: DB, id: number, input: RecurringUpdateInput): RecurringRule | undefined {
  const patch: Partial<typeof recurringRules.$inferInsert> = { ...input };
  if (input.nextDueDate) patch.anchorDay = parseISODate(input.nextDueDate).d;
  if (Object.keys(patch).length === 0) return getRecurringRule(db, id);
  return db.update(recurringRules).set(patch).where(eq(recurringRules.id, id)).returning().get();
}

export function deleteRecurringRule(db: DB, id: number): boolean {
  return db.delete(recurringRules).where(eq(recurringRules.id, id)).run().changes > 0;
}
