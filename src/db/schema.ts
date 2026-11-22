import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export const CATEGORY_TYPES = ["INCOME", "EXPENSE"] as const;
export const TRANSACTION_TYPES = ["INCOME", "EXPENSE", "TRANSFER"] as const;
export const PAYMENT_METHODS = [
  "DEBIT",
  "CREDIT",
  "BANK_TRANSFER",
  "CASH",
  "OTHER",
] as const;
export const FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;

export type CategoryType = (typeof CATEGORY_TYPES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type Frequency = (typeof FREQUENCIES)[number];

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    baseCurrency: text("baseCurrency").notNull().default("EUR"),
    monthStartDay: integer("monthStartDay").notNull().default(1),
    updatedAt: text("updatedAt").notNull().default(nowIso),
  },
  (t) => [
    check("settings_singleton", sql`${t.id} = 1`),
    check("settings_month_start", sql`${t.monthStartDay} BETWEEN 1 AND 28`),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    type: text("type", { enum: CATEGORY_TYPES }).notNull(),
    groupName: text("groupName").notNull(),
    isFixed: integer("isFixed", { mode: "boolean" }).notNull().default(false),
    monthlyBudgetCents: integer("monthlyBudgetCents"),
    color: text("color").notNull(),
    icon: text("icon").notNull(),
    isArchived: integer("isArchived", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    check(
      "categories_budget_positive",
      sql`${t.monthlyBudgetCents} IS NULL OR ${t.monthlyBudgetCents} > 0`,
    ),
  ],
);

export const recurringRules = sqliteTable(
  "recurring_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    amountCents: integer("amountCents").notNull(),
    currency: text("currency").notNull(),
    type: text("type", { enum: CATEGORY_TYPES }).notNull(),
    categoryId: integer("categoryId")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    paymentMethod: text("paymentMethod", { enum: PAYMENT_METHODS })
      .notNull()
      .default("BANK_TRANSFER"),
    frequency: text("frequency", { enum: FREQUENCIES }).notNull(),
    anchorDay: integer("anchorDay").notNull(),
    nextDueDate: text("nextDueDate").notNull(),
    lastGeneratedDate: text("lastGeneratedDate"),
    isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
    notes: text("notes"),
    createdAt: text("createdAt").notNull().default(nowIso),
  },
  (t) => [
    check("recurring_amount_positive", sql`${t.amountCents} > 0`),
    check("recurring_anchor_day", sql`${t.anchorDay} BETWEEN 1 AND 31`),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    amountCents: integer("amountCents").notNull(),
    currency: text("currency").notNull(),
    type: text("type", { enum: TRANSACTION_TYPES }).notNull(),
    categoryId: integer("categoryId").references(() => categories.id),
    merchant: text("merchant").notNull(),
    paymentMethod: text("paymentMethod", { enum: PAYMENT_METHODS })
      .notNull()
      .default("DEBIT"),
    notes: text("notes"),
    recurringRuleId: integer("recurringRuleId").references(
      () => recurringRules.id,
      { onDelete: "set null" },
    ),
    createdAt: text("createdAt").notNull().default(nowIso),
  },
  (t) => [
    index("idx_transactions_date").on(t.date),
    index("idx_transactions_category").on(t.categoryId),
    uniqueIndex("uidx_transactions_recurring_date")
      .on(t.recurringRuleId, t.date)
      .where(sql`${t.recurringRuleId} IS NOT NULL`),
    check("transactions_amount_positive", sql`${t.amountCents} > 0`),
  ],
);

export const holdings = sqliteTable(
  "holdings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticker: text("ticker").notNull().unique(),
    name: text("name").notNull(),
    exchange: text("exchange"),
    shares: real("shares").notNull(),
    avgCostPerShare: real("avgCostPerShare"),
    currency: text("currency").notNull(),
    notes: text("notes"),
    updatedAt: text("updatedAt").notNull().default(nowIso),
  },
  (t) => [check("holdings_shares_positive", sql`${t.shares} > 0`)],
);

export const stockPrices = sqliteTable("stock_prices", {
  ticker: text("ticker").primaryKey(),
  closePrice: real("closePrice").notNull(),
  previousClose: real("previousClose").notNull(),
  currency: text("currency").notNull(),
  priceDate: text("priceDate").notNull(),
  fetchedAt: text("fetchedAt").notNull(),
});

export const fxRates = sqliteTable("fx_rates", {
  pair: text("pair").primaryKey(),
  rate: real("rate").notNull(),
  fetchedAt: text("fetchedAt").notNull(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
  recurringRules: many(recurringRules),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  recurringRule: one(recurringRules, {
    fields: [transactions.recurringRuleId],
    references: [recurringRules.id],
  }),
}));

export const recurringRulesRelations = relations(
  recurringRules,
  ({ one, many }) => ({
    category: one(categories, {
      fields: [recurringRules.categoryId],
      references: [categories.id],
    }),
    transactions: many(transactions),
  }),
);

export type Settings = typeof settings.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type StockPrice = typeof stockPrices.$inferSelect;
export type FxRate = typeof fxRates.$inferSelect;
