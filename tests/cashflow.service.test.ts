import { beforeEach, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import { getBillingPeriodRange, getYearMonthForDate } from "@/lib/period";
import {
  getBudgetStatuses,
  getCashFlowSummary,
  getCategoryBreakdown,
} from "@/services/cashflow.service";
import { updateCategory } from "@/services/categories.service";
import { createTransaction } from "@/services/transactions.service";
import { categoryId, createTestDb } from "./helpers/test-db";

describe("getBillingPeriodRange", () => {
  it("uses calendar months when monthStartDay = 1", () => {
    expect(getBillingPeriodRange("2026-02", 1)).toEqual({ startDate: "2026-02-01", endDate: "2026-02-28" });
    expect(getBillingPeriodRange("2024-02", 1)).toEqual({ startDate: "2024-02-01", endDate: "2024-02-29" });
    expect(getBillingPeriodRange("2026-11", 1)).toEqual({ startDate: "2026-11-01", endDate: "2026-11-30" });
  });

  it("runs 25th to 24th when monthStartDay = 25", () => {
    expect(getBillingPeriodRange("2026-11", 25)).toEqual({ startDate: "2026-10-25", endDate: "2026-11-24" });
    expect(getBillingPeriodRange("2026-01", 25)).toEqual({ startDate: "2025-12-25", endDate: "2026-01-24" });
  });

  it("maps a date to its billing period", () => {
    expect(getYearMonthForDate("2026-11-24", 25)).toBe("2026-11");
    expect(getYearMonthForDate("2026-11-25", 25)).toBe("2026-12");
    expect(getYearMonthForDate("2026-12-31", 25)).toBe("2027-01");
    expect(getYearMonthForDate("2026-11-30", 1)).toBe("2026-11");
  });
});

describe("cash flow summary", () => {
  let db: DB;
  beforeEach(() => {
    db = createTestDb();
    const base = { currency: "EUR", paymentMethod: "DEBIT" as const, notes: null };
    createTransaction(db, { ...base, date: "2026-11-01", amountCents: 300000, type: "INCOME", categoryId: categoryId(db, "Salary"), merchant: "Employer" });
    createTransaction(db, { ...base, date: "2026-11-02", amountCents: 120000, type: "EXPENSE", categoryId: categoryId(db, "Rent / Mortgage"), merchant: "Landlord" });
    createTransaction(db, { ...base, date: "2026-11-03", amountCents: 1500, type: "EXPENSE", categoryId: categoryId(db, "Streaming & Media"), merchant: "Netflix" });
    createTransaction(db, { ...base, date: "2026-11-05", amountCents: 8000, type: "EXPENSE", categoryId: categoryId(db, "Groceries"), merchant: "Supermarket" });
    createTransaction(db, { ...base, date: "2026-11-06", amountCents: 50000, type: "TRANSFER", categoryId: null, merchant: "To savings" });
    // Outside the period
    createTransaction(db, { ...base, date: "2026-10-31", amountCents: 9999, type: "EXPENSE", categoryId: categoryId(db, "Groceries"), merchant: "Old" });
  });

  it("excludes TRANSFER transactions from income, expense and savings rate", () => {
    const s = getCashFlowSummary(db, "2026-11-01", "2026-11-30", "EUR");
    expect(s.totalIncomeCents).toBe(300000);
    expect(s.totalExpenseCents).toBe(129500);
    expect(s.netCashFlowCents).toBe(170500);
    expect(s.savingsRatePercent).toBeCloseTo((170500 / 300000) * 100);
  });

  it("splits fixed vs variable by category.isFixed", () => {
    const s = getCashFlowSummary(db, "2026-11-01", "2026-11-30", "EUR");
    expect(s.fixedExpenseCents).toBe(121500);
    expect(s.variableExpenseCents).toBe(8000);
  });

  it("returns null savings rate with no income", () => {
    const s = getCashFlowSummary(db, "2026-10-01", "2026-10-31", "EUR");
    expect(s.totalIncomeCents).toBe(0);
    expect(s.savingsRatePercent).toBeNull();
  });

  it("builds category breakdown with percentages summing to 100", () => {
    const b = getCategoryBreakdown(db, "2026-11-01", "2026-11-30", "EUR");
    expect(b[0].name).toBe("Rent / Mortgage");
    expect(b.reduce((s, c) => s + c.percentage, 0)).toBeCloseTo(100);
  });

  it("sorts budgets by utilization descending", () => {
    updateCategory(db, categoryId(db, "Groceries"), { monthlyBudgetCents: 10000 });
    updateCategory(db, categoryId(db, "Restaurants & Takeout"), { monthlyBudgetCents: 5000 });
    updateCategory(db, categoryId(db, "Streaming & Media"), { monthlyBudgetCents: 1000 });
    const budgets = getBudgetStatuses(db, "2026-11-01", "2026-11-30", "EUR");
    expect(budgets.map((b) => b.name)).toEqual(["Streaming & Media", "Groceries", "Restaurants & Takeout"]);
    expect(budgets[0].utilizationPercent).toBeCloseTo(150);
    expect(budgets[0].remainingCents).toBe(-500);
  });
});
