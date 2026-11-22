import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { DB } from "@/db";
import { categories, recurringRules } from "@/db/schema";
import { addDays, todayISODate } from "@/lib/dates";
import { getBillingPeriodRange, getYearMonthForDate } from "@/lib/period";
import {
  getBudgetStatuses,
  getCashFlowSummary,
  getCategoryBreakdown,
  getMonthlyTrend,
} from "./cashflow.service";
import { getPortfolio } from "./portfolio.service";
import { syncRecurringTransactions } from "./recurring.service";
import { getSettings } from "./settings.service";
import { listTransactions } from "./transactions.service";

export function getUpcomingBills(db: DB, today: string, days = 30) {
  return db
    .select({
      id: recurringRules.id,
      name: recurringRules.name,
      amountCents: recurringRules.amountCents,
      currency: recurringRules.currency,
      frequency: recurringRules.frequency,
      nextDueDate: recurringRules.nextDueDate,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
    })
    .from(recurringRules)
    .leftJoin(categories, eq(recurringRules.categoryId, categories.id))
    .where(
      and(
        eq(recurringRules.isActive, true),
        eq(recurringRules.type, "EXPENSE"),
        gte(recurringRules.nextDueDate, today),
        lte(recurringRules.nextDueDate, addDays(today, days)),
      ),
    )
    .orderBy(asc(recurringRules.nextDueDate))
    .all();
}

export function getDashboard(db: DB, yearMonth?: string) {
  const today = todayISODate();
  syncRecurringTransactions(db, today);

  const { baseCurrency, monthStartDay } = getSettings(db);
  const ym = yearMonth ?? getYearMonthForDate(today, monthStartDay);
  const { startDate, endDate } = getBillingPeriodRange(ym, monthStartDay);
  const portfolio = getPortfolio(db);

  return {
    baseCurrency,
    period: { yearMonth: ym, startDate, endDate },
    summary: getCashFlowSummary(db, startDate, endDate, baseCurrency),
    monthlyTrend: getMonthlyTrend(db, ym, monthStartDay, baseCurrency, 6),
    categoryBreakdown: getCategoryBreakdown(db, startDate, endDate, baseCurrency),
    budgetAlerts: getBudgetStatuses(db, startDate, endDate, baseCurrency),
    upcomingBills: getUpcomingBills(db, today),
    recentTransactions: listTransactions(db, { limit: 8, offset: 0 }).items,
    portfolioSummary: {
      totalValueBase: portfolio.summary.totalValueBase,
      dayChangeBase: portfolio.summary.totalDayChangeBase,
      dayChangePercent: portfolio.summary.totalDayChangePercent,
      baseCurrency,
      isStale: portfolio.isStale,
      lastUpdated: portfolio.lastUpdated,
      holdingsCount: portfolio.summary.holdingsCount,
    },
  };
}

export type DashboardPayload = ReturnType<typeof getDashboard>;
