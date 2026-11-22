export type { Category, Holding, RecurringRule, Settings, Transaction } from "@/db/schema";
export type { TransactionWithCategory } from "@/services/transactions.service";
export type { RecurringRuleWithCategory } from "@/services/recurring.service";
export type { EnrichedHolding, PortfolioPayload, PortfolioSummary } from "@/services/portfolio.service";
export type { DashboardPayload } from "@/services/dashboard.service";
export type { BudgetStatus, CashFlowSummary, CategorySpend } from "@/services/cashflow.service";
export type { TickerSearchResult } from "@/services/market-data.service";

export interface RecurringListPayload {
  rules: import("@/services/recurring.service").RecurringRuleWithCategory[];
  monthlyFixedExpenseCents: number;
  monthlyFixedIncomeCents: number;
}

export type PortfolioRefreshPayload = import("@/services/portfolio.service").PortfolioPayload & {
  warnings: { ticker: string; error: string }[];
  updatedTickers: string[];
};
