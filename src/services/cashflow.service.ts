import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { categories, transactions } from "@/db/schema";
import { shiftYearMonth } from "@/lib/dates";
import { getBillingPeriodRange } from "@/lib/period";

export interface CashFlowSummary {
  totalIncomeCents: number;
  totalExpenseCents: number;
  fixedExpenseCents: number;
  variableExpenseCents: number;
  netCashFlowCents: number;
  savingsRatePercent: number | null;
}

export interface CategorySpend {
  categoryId: number;
  name: string;
  color: string;
  icon: string;
  amountCents: number;
  percentage: number;
}

export interface BudgetStatus {
  categoryId: number;
  name: string;
  color: string;
  icon: string;
  groupName: string;
  isFixed: boolean;
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  utilizationPercent: number;
}

/**
 * Income/expense totals for a date range (inclusive).
 * Only transactions in baseCurrency are summed; TRANSFERs are excluded.
 */
export function getCashFlowSummary(db: DB, startDate: string, endDate: string, baseCurrency: string): CashFlowSummary {
  const row = db
    .select({
      income: sql<number>`coalesce(sum(case when ${transactions.type} = 'INCOME' then ${transactions.amountCents} end), 0)`,
      expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'EXPENSE' then ${transactions.amountCents} end), 0)`,
      fixed: sql<number>`coalesce(sum(case when ${transactions.type} = 'EXPENSE' and ${categories.isFixed} = 1 then ${transactions.amountCents} end), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        eq(transactions.currency, baseCurrency),
      ),
    )
    .get();

  const totalIncomeCents = Number(row?.income ?? 0);
  const totalExpenseCents = Number(row?.expense ?? 0);
  const fixedExpenseCents = Number(row?.fixed ?? 0);
  const netCashFlowCents = totalIncomeCents - totalExpenseCents;
  return {
    totalIncomeCents,
    totalExpenseCents,
    fixedExpenseCents,
    variableExpenseCents: totalExpenseCents - fixedExpenseCents,
    netCashFlowCents,
    savingsRatePercent: totalIncomeCents > 0 ? (netCashFlowCents / totalIncomeCents) * 100 : null,
  };
}

/** Spending per expense category for the range, sorted largest first. */
export function getCategoryBreakdown(db: DB, startDate: string, endDate: string, baseCurrency: string): CategorySpend[] {
  const rows = db
    .select({
      categoryId: categories.id,
      name: categories.name,
      color: categories.color,
      icon: categories.icon,
      amountCents: sql<number>`sum(${transactions.amountCents})`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.type, "EXPENSE"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        eq(transactions.currency, baseCurrency),
      ),
    )
    .groupBy(categories.id)
    .orderBy(desc(sql`sum(${transactions.amountCents})`))
    .all();

  const total = rows.reduce((s, r) => s + Number(r.amountCents), 0);
  return rows.map((r) => ({
    ...r,
    amountCents: Number(r.amountCents),
    percentage: total > 0 ? (Number(r.amountCents) / total) * 100 : 0,
  }));
}

/** Budgeted categories with spend in range, sorted by utilization descending. */
export function getBudgetStatuses(db: DB, startDate: string, endDate: string, baseCurrency: string): BudgetStatus[] {
  const budgeted = db
    .select()
    .from(categories)
    .where(and(isNotNull(categories.monthlyBudgetCents), eq(categories.isArchived, false)))
    .all();
  const spendById = new Map(
    getCategoryBreakdown(db, startDate, endDate, baseCurrency).map((c) => [c.categoryId, c.amountCents]),
  );
  return budgeted
    .map((c) => {
      const budgetCents = c.monthlyBudgetCents!;
      const spentCents = spendById.get(c.id) ?? 0;
      return {
        categoryId: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        groupName: c.groupName,
        isFixed: c.isFixed,
        budgetCents,
        spentCents,
        remainingCents: budgetCents - spentCents,
        utilizationPercent: (spentCents / budgetCents) * 100,
      };
    })
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent);
}

/** Income & expense for the `count` billing periods ending at `yearMonth` (oldest first). */
export function getMonthlyTrend(
  db: DB,
  yearMonth: string,
  monthStartDay: number,
  baseCurrency: string,
  periods = 6,
): { yearMonth: string; incomeCents: number; expenseCents: number }[] {
  const out = [];
  for (let i = periods - 1; i >= 0; i--) {
    const ym = shiftYearMonth(yearMonth, -i);
    const { startDate, endDate } = getBillingPeriodRange(ym, monthStartDay);
    const s = getCashFlowSummary(db, startDate, endDate, baseCurrency);
    out.push({ yearMonth: ym, incomeCents: s.totalIncomeCents, expenseCents: s.totalExpenseCents });
  }
  return out;
}
