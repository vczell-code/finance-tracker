import { z } from "zod";
import {
  CATEGORY_TYPES,
  CURRENCIES,
  FREQUENCIES,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
} from "@/db/schema";
import { isValidISODate } from "./dates";

export const isoDate = z.string().refine(isValidISODate, "Must be a valid YYYY-MM-DD date");
export const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Must be YYYY-MM");
export const currency = z.enum(CURRENCIES);
export const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Must be an ISO-4217 code");
export const positiveCents = z.number().int().positive();
const optionalText = z
  .string()
  .trim()
  .max(1000)
  .nullish()
  .transform((v) => (v ? v : null));

const transactionBase = z.object({
  date: isoDate,
  amountCents: positiveCents,
  currency: currencyCode.optional(),
  type: z.enum(TRANSACTION_TYPES),
  categoryId: z.number().int().positive().nullish(),
  merchant: z.string().trim().min(1, "Merchant is required").max(200),
  paymentMethod: z.enum(PAYMENT_METHODS).default("DEBIT"),
  notes: optionalText,
});

export const transactionCreateSchema = transactionBase.superRefine((v, ctx) => {
  if (v.type !== "TRANSFER" && !v.categoryId) {
    ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Category is required for income and expenses" });
  }
});
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;

export const transactionUpdateSchema = z.object({
  date: isoDate.optional(),
  amountCents: positiveCents.optional(),
  currency: currencyCode.optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  merchant: z.string().trim().min(1).max(200).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  notes: optionalText.optional(),
});
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;

export const transactionQuerySchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

export const recurringCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  amountCents: positiveCents,
  currency: currencyCode.optional(),
  type: z.enum(CATEGORY_TYPES),
  categoryId: z.number().int().positive(),
  paymentMethod: z.enum(PAYMENT_METHODS).default("BANK_TRANSFER"),
  frequency: z.enum(FREQUENCIES),
  nextDueDate: isoDate,
  notes: optionalText,
});
export type RecurringCreateInput = z.infer<typeof recurringCreateSchema>;

export const recurringUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  amountCents: positiveCents.optional(),
  currency: currencyCode.optional(),
  type: z.enum(CATEGORY_TYPES).optional(),
  categoryId: z.number().int().positive().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  nextDueDate: isoDate.optional(),
  notes: optionalText.optional(),
  isActive: z.boolean().optional(),
});
export type RecurringUpdateInput = z.infer<typeof recurringUpdateSchema>;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex colour like #3b82f6");
export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(CATEGORY_TYPES),
  groupName: z.string().trim().min(1).max(100),
  isFixed: z.boolean().default(false),
  monthlyBudgetCents: positiveCents.nullish(),
  color: hexColor,
  icon: z.string().trim().min(1).max(50),
});
export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.enum(CATEGORY_TYPES).optional(),
  groupName: z.string().trim().min(1).max(100).optional(),
  isFixed: z.boolean().optional(),
  monthlyBudgetCents: positiveCents.nullable().optional(),
  color: hexColor.optional(),
  icon: z.string().trim().min(1).max(50).optional(),
  isArchived: z.boolean().optional(),
});

export const holdingCreateSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((s) => s.toUpperCase()),
  shares: z.number().positive(),
  avgCostPerShare: z.number().positive().nullish(),
  notes: optionalText,
});
export const holdingUpdateSchema = z.object({
  shares: z.number().positive().optional(),
  avgCostPerShare: z.number().positive().nullable().optional(),
  notes: optionalText.optional(),
});

export const settingsUpdateSchema = z.object({
  baseCurrency: currency.optional(),
  monthStartDay: z.number().int().min(1).max(28).optional(),
});

export const csvImportRowSchema = z.object({
  date: isoDate,
  amountCents: positiveCents,
  currency: currencyCode.optional(),
  type: z.enum(TRANSACTION_TYPES),
  category: z.string().trim().nullish(),
  merchant: z.string().trim().min(1).max(200),
  paymentMethod: z.enum(PAYMENT_METHODS).default("DEBIT"),
  notes: optionalText,
});
export type CsvImportRow = z.infer<typeof csvImportRowSchema>;

export const csvImportSchema = z.object({
  rows: z.array(csvImportRowSchema).min(1).max(10000),
  createMissingCategories: z.boolean().default(true),
});
