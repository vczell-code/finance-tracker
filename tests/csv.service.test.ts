import { describe, expect, it } from "vitest";
import { transactions } from "@/db/schema";
import { exportTransactionsCsv, importTransactions } from "@/services/csv-db.service";
import { escapeCsvField, parseCsv, parseCsvObjects, toCsv } from "@/services/csv.service";
import { createTransaction } from "@/services/transactions.service";
import { categoryId, createTestDb } from "./helpers/test-db";

describe("escapeCsvField", () => {
  it("leaves plain values untouched", () => {
    expect(escapeCsvField("Spotify")).toBe("Spotify");
    expect(escapeCsvField(12.5)).toBe("12.5");
    expect(escapeCsvField(null)).toBe("");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(escapeCsvField("Smith, John")).toBe('"Smith, John"');
    expect(escapeCsvField('The "Best" Cafe')).toBe('"The ""Best"" Cafe"');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvField("a\r\nb")).toBe('"a\r\nb"');
  });
});

describe("toCsv / parseCsv round trip", () => {
  it("round-trips tricky merchant and notes values", () => {
    const rows = [
      { merchant: 'Joe\'s "Diner", Downtown', notes: "multi\nline, note" },
      { merchant: "Plain", notes: "" },
    ];
    const csv = toCsv(rows, [
      { header: "merchant", value: (r) => r.merchant },
      { header: "notes", value: (r) => r.notes },
    ]);
    expect(csv.split("\r\n")[0]).toBe("merchant,notes");
    expect(parseCsv(csv)).toEqual([
      ["merchant", "notes"],
      ['Joe\'s "Diner", Downtown', "multi\nline, note"],
      ["Plain", ""],
    ]);
  });

  it("parses into objects with lower-cased headers and strips BOM", () => {
    expect(parseCsvObjects("﻿Date,Merchant\n2026-11-01,Shop\n")).toEqual([{ date: "2026-11-01", merchant: "Shop" }]);
  });
});

describe("transactions CSV export/import", () => {
  it("exports escaped rows and re-imports them atomically", () => {
    const db = createTestDb();
    createTransaction(db, {
      date: "2026-11-01",
      amountCents: 1234,
      type: "EXPENSE",
      categoryId: categoryId(db, "Groceries"),
      merchant: "Market, Inc.",
      paymentMethod: "DEBIT",
      notes: 'said "hi"',
    });
    const csv = exportTransactionsCsv(db);
    expect(csv).toContain('"Market, Inc."');
    expect(csv).toContain('"said ""hi"""');
    expect(csv).toContain("12.34");

    const res = importTransactions(
      db,
      [
        { date: "2026-11-02", amountCents: 500, type: "EXPENSE", category: "groceries", merchant: "A", paymentMethod: "CASH", notes: null },
        { date: "2026-11-03", amountCents: 700, type: "EXPENSE", category: "Brand New", merchant: "B", paymentMethod: "CASH", notes: null },
      ],
      true,
    );
    expect(res).toEqual({ importedCount: 2, createdCategories: ["Brand New"] });
    expect(db.select().from(transactions).all()).toHaveLength(3);
  });

  it("rolls back the whole import when a row is invalid", () => {
    const db = createTestDb();
    expect(() =>
      importTransactions(
        db,
        [
          { date: "2026-11-02", amountCents: 500, type: "EXPENSE", category: "Groceries", merchant: "A", paymentMethod: "CASH", notes: null },
          { date: "2026-11-03", amountCents: 700, type: "EXPENSE", category: "Unknown", merchant: "B", paymentMethod: "CASH", notes: null },
        ],
        false,
      ),
    ).toThrow(/unknown category/);
    expect(db.select().from(transactions).all()).toHaveLength(0);
  });
});
