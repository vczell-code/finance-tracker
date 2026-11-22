import type { DB } from "@/db";
import { categories, transactions } from "@/db/schema";
import { centsToInput } from "@/lib/format";
import type { CsvImportRow } from "@/lib/validation";
import { listCategories } from "./categories.service";
import { toCsv } from "./csv.service";
import { getPortfolio } from "./portfolio.service";
import { getSettings } from "./settings.service";
import { listTransactions } from "./transactions.service";

export function exportTransactionsCsv(db: DB): string {
  const { items } = listTransactions(db, { limit: Number.MAX_SAFE_INTEGER, offset: 0 });
  return toCsv(items, [
    { header: "date", value: (t) => t.date },
    { header: "type", value: (t) => t.type },
    { header: "amount", value: (t) => centsToInput(t.amountCents) },
    { header: "currency", value: (t) => t.currency },
    { header: "category", value: (t) => t.category?.name ?? "" },
    { header: "merchant", value: (t) => t.merchant },
    { header: "paymentMethod", value: (t) => t.paymentMethod },
    { header: "notes", value: (t) => t.notes ?? "" },
  ]);
}

export function exportHoldingsCsv(db: DB): string {
  const p = getPortfolio(db);
  return toCsv(p.holdings, [
    { header: "ticker", value: (h) => h.ticker },
    { header: "name", value: (h) => h.name },
    { header: "exchange", value: (h) => h.exchange ?? "" },
    { header: "shares", value: (h) => h.shares },
    { header: "avgCostPerShare", value: (h) => h.avgCostPerShare ?? "" },
    { header: "currency", value: (h) => h.currency },
    { header: "closePrice", value: (h) => h.closePrice ?? "" },
    { header: "priceDate", value: (h) => h.priceDate ?? "" },
    { header: `marketValue${p.baseCurrency}`, value: (h) => h.baseMarketValue?.toFixed(2) ?? "" },
    { header: "notes", value: (h) => h.notes ?? "" },
  ]);
}

export class ImportError extends Error {
  constructor(
    message: string,
    public row: number,
  ) {
    super(message);
  }
}

/** Imports all rows atomically: any failure rolls back the whole batch. */
export function importTransactions(db: DB, rows: CsvImportRow[], createMissingCategories: boolean): { importedCount: number; createdCategories: string[] } {
  const { baseCurrency } = getSettings(db);
  const byName = new Map(listCategories(db, true).map((c) => [`${c.type}:${c.name.toLowerCase()}`, c.id]));
  const createdCategories: string[] = [];

  db.transaction((tx) => {
    rows.forEach((r, i) => {
      let categoryId: number | null = null;
      if (r.type !== "TRANSFER") {
        const name = r.category?.trim();
        if (!name) throw new ImportError(`Row ${i + 1}: category is required for ${r.type}`, i + 1);
        const key = `${r.type}:${name.toLowerCase()}`;
        categoryId = byName.get(key) ?? null;
        if (categoryId === null) {
          if (!createMissingCategories) throw new ImportError(`Row ${i + 1}: unknown category "${name}"`, i + 1);
          const created = tx
            .insert(categories)
            .values({
              name,
              type: r.type,
              groupName: "Imported",
              isFixed: false,
              color: "#94a3b8",
              icon: r.type === "INCOME" ? "trending-up" : "tag",
            })
            .returning()
            .get();
          categoryId = created.id;
          byName.set(key, categoryId);
          createdCategories.push(name);
        }
      }
      tx.insert(transactions)
        .values({
          date: r.date,
          amountCents: r.amountCents,
          currency: r.currency ?? baseCurrency,
          type: r.type,
          categoryId,
          merchant: r.merchant,
          paymentMethod: r.paymentMethod,
          notes: r.notes,
          createdAt: new Date().toISOString(),
        })
        .run();
    });
  });

  return { importedCount: rows.length, createdCategories };
}
