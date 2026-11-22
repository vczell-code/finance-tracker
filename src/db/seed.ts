import { count } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { categories, settings } from "./schema";

type SeedCategory = Omit<typeof categories.$inferInsert, "id" | "isArchived">;

const DEFAULT_CATEGORIES: SeedCategory[] = [
  // Fixed expenses
  { name: "Rent / Mortgage", type: "EXPENSE", groupName: "Housing", isFixed: true, color: "#6366f1", icon: "home" },
  { name: "Utilities", type: "EXPENSE", groupName: "Housing", isFixed: true, color: "#8b5cf6", icon: "zap" },
  { name: "Internet & Phone", type: "EXPENSE", groupName: "Housing", isFixed: true, color: "#a855f7", icon: "wifi" },
  { name: "Streaming & Media", type: "EXPENSE", groupName: "Subscriptions", isFixed: true, color: "#ec4899", icon: "tv" },
  { name: "Software & Cloud", type: "EXPENSE", groupName: "Subscriptions", isFixed: true, color: "#d946ef", icon: "cloud" },
  { name: "Gym & Fitness", type: "EXPENSE", groupName: "Subscriptions", isFixed: true, color: "#f43f5e", icon: "dumbbell" },
  { name: "Insurance", type: "EXPENSE", groupName: "Insurance & Financial", isFixed: true, color: "#0ea5e9", icon: "shield" },
  { name: "Taxes & Bank Fees", type: "EXPENSE", groupName: "Insurance & Financial", isFixed: true, color: "#64748b", icon: "landmark" },
  // Variable expenses
  { name: "Groceries", type: "EXPENSE", groupName: "Food", isFixed: false, color: "#22c55e", icon: "shopping-cart" },
  { name: "Restaurants & Takeout", type: "EXPENSE", groupName: "Food", isFixed: false, color: "#f97316", icon: "utensils" },
  { name: "Coffee & Snacks", type: "EXPENSE", groupName: "Food", isFixed: false, color: "#a16207", icon: "coffee" },
  { name: "Public Transit & Fuel", type: "EXPENSE", groupName: "Transport", isFixed: false, color: "#eab308", icon: "bus" },
  { name: "Travel & Flights", type: "EXPENSE", groupName: "Transport", isFixed: false, color: "#06b6d4", icon: "plane" },
  { name: "Health & Pharmacy", type: "EXPENSE", groupName: "Personal", isFixed: false, color: "#ef4444", icon: "heart-pulse" },
  { name: "Clothing & Shopping", type: "EXPENSE", groupName: "Personal", isFixed: false, color: "#db2777", icon: "shirt" },
  { name: "Entertainment & Hobbies", type: "EXPENSE", groupName: "Personal", isFixed: false, color: "#7c3aed", icon: "gamepad-2" },
  { name: "Other Expense", type: "EXPENSE", groupName: "Personal", isFixed: false, color: "#78716c", icon: "circle-ellipsis" },
  // Income
  { name: "Salary", type: "INCOME", groupName: "Income", isFixed: false, color: "#16a34a", icon: "briefcase" },
  { name: "Freelance & Bonus", type: "INCOME", groupName: "Income", isFixed: false, color: "#059669", icon: "sparkles" },
  { name: "Dividends & Interest", type: "INCOME", groupName: "Income", isFixed: false, color: "#0d9488", icon: "trending-up" },
  { name: "Refunds & Gifts", type: "INCOME", groupName: "Income", isFixed: false, color: "#65a30d", icon: "gift" },
];

/** Idempotent: inserts settings row if missing and default categories only when none exist. */
export function seedIfNeeded(db: BetterSQLite3Database<typeof schema>): void {
  db.transaction((tx) => {
    tx.insert(settings)
      .values({ id: 1, baseCurrency: "EUR", monthStartDay: 1, updatedAt: new Date().toISOString() })
      .onConflictDoNothing()
      .run();
    const [{ n }] = tx.select({ n: count() }).from(categories).all();
    if (n === 0) {
      tx.insert(categories).values(DEFAULT_CATEGORIES).run();
    }
  });
}
