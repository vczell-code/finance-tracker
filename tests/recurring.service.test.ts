import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import { recurringRules, transactions } from "@/db/schema";
import {
  advanceDueDate,
  createRecurringRule,
  deleteRecurringRule,
  monthlyNormalizedCents,
  syncRecurringTransactions,
} from "@/services/recurring.service";
import { categoryId, createTestDb } from "./helpers/test-db";

describe("advanceDueDate", () => {
  it("clamps monthly anchorDay 31: Jan 31 -> Feb 28 -> Mar 31", () => {
    const feb = advanceDueDate("2026-01-31", "MONTHLY", 31);
    expect(feb).toBe("2026-02-28");
    expect(advanceDueDate(feb, "MONTHLY", 31)).toBe("2026-03-31");
  });

  it("handles leap-year yearly rule: 2024-02-29 -> 2025-02-28 -> 2026-02-28, back to 29 on 2028", () => {
    expect(advanceDueDate("2024-02-29", "YEARLY", 29)).toBe("2025-02-28");
    expect(advanceDueDate("2027-02-28", "YEARLY", 29)).toBe("2028-02-29");
  });

  it("advances weekly by 7 days across month/year boundaries", () => {
    expect(advanceDueDate("2026-12-29", "WEEKLY", 29)).toBe("2027-01-05");
  });

  it("advances quarterly with clamping", () => {
    expect(advanceDueDate("2026-11-30", "QUARTERLY", 31)).toBe("2027-02-28");
    expect(advanceDueDate("2027-02-28", "QUARTERLY", 31)).toBe("2027-05-31");
  });
});

describe("monthlyNormalizedCents", () => {
  it("normalises each frequency to a monthly amount", () => {
    expect(monthlyNormalizedCents({ amountCents: 1200, frequency: "WEEKLY" })).toBeCloseTo(5200);
    expect(monthlyNormalizedCents({ amountCents: 999, frequency: "MONTHLY" })).toBe(999);
    expect(monthlyNormalizedCents({ amountCents: 3000, frequency: "QUARTERLY" })).toBe(1000);
    expect(monthlyNormalizedCents({ amountCents: 12000, frequency: "YEARLY" })).toBe(1000);
  });
});

describe("syncRecurringTransactions", () => {
  let db: DB;
  beforeEach(() => {
    db = createTestDb();
  });

  function makeRule(nextDueDate: string, frequency: "MONTHLY" | "WEEKLY" = "MONTHLY") {
    return createRecurringRule(db, {
      name: "Spotify",
      amountCents: 1099,
      type: "EXPENSE",
      categoryId: categoryId(db, "Streaming & Media"),
      paymentMethod: "CREDIT",
      frequency,
      nextDueDate,
      notes: null,
    });
  }

  it("catches up: rule due 3 months ago generates 3 transactions and moves into the future", () => {
    const rule = makeRule("2026-08-15");
    const res = syncRecurringTransactions(db, "2026-10-20");
    expect(res).toEqual({ generatedCount: 3, rulesProcessed: 1 });

    const txs = db.select().from(transactions).where(eq(transactions.recurringRuleId, rule.id)).all();
    expect(txs.map((t) => t.date).sort()).toEqual(["2026-08-15", "2026-09-15", "2026-10-15"]);
    expect(txs.every((t) => t.amountCents === 1099 && t.merchant === "Spotify" && t.currency === "EUR")).toBe(true);

    const updated = db.select().from(recurringRules).where(eq(recurringRules.id, rule.id)).get()!;
    expect(updated.nextDueDate).toBe("2026-11-15");
    expect(updated.lastGeneratedDate).toBe("2026-10-15");
  });

  it("is idempotent: syncing twice on the same day creates no duplicates", () => {
    makeRule("2026-09-01");
    const first = syncRecurringTransactions(db, "2026-11-22");
    const second = syncRecurringTransactions(db, "2026-11-22");
    expect(first.generatedCount).toBe(3);
    expect(second.generatedCount).toBe(0);
    expect(db.select().from(transactions).all()).toHaveLength(3);
  });

  it("does not duplicate even if nextDueDate is rewound (DB unique index)", () => {
    const rule = makeRule("2026-10-01");
    syncRecurringTransactions(db, "2026-11-22");
    db.update(recurringRules).set({ nextDueDate: "2026-10-01" }).where(eq(recurringRules.id, rule.id)).run();
    const again = syncRecurringTransactions(db, "2026-11-22");
    expect(again.generatedCount).toBe(0);
    expect(db.select().from(transactions).all()).toHaveLength(2);
  });

  it("skips paused rules", () => {
    const rule = makeRule("2026-10-01");
    db.update(recurringRules).set({ isActive: false }).where(eq(recurringRules.id, rule.id)).run();
    expect(syncRecurringTransactions(db, "2026-11-22").generatedCount).toBe(0);
  });

  it("caps iterations at 60 per rule", () => {
    makeRule("2020-01-01", "WEEKLY");
    expect(syncRecurringTransactions(db, "2026-11-22").generatedCount).toBe(60);
  });

  it("deleting a rule keeps historical transactions with recurringRuleId = NULL", () => {
    const rule = makeRule("2026-10-01");
    syncRecurringTransactions(db, "2026-11-22");
    deleteRecurringRule(db, rule.id);
    const txs = db.select().from(transactions).all();
    expect(txs).toHaveLength(2);
    expect(txs.every((t) => t.recurringRuleId === null)).toBe(true);
  });
});
