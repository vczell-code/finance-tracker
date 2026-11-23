"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, LineChart, PiggyBank, Wallet } from "lucide-react";
import { CashFlowBar } from "@/components/charts/cash-flow-bar";
import { CategoryDonut } from "@/components/charts/category-donut";
import { BudgetBar } from "@/components/budget-bar";
import { CategoryIcon } from "@/components/category-icon";
import { LastUpdated, RefreshWarning } from "@/components/portfolio/portfolio-status";
import { UpcomingBillsCard } from "@/components/recurring/upcoming-bills-card";
import { ErrorNote, MonthPicker, PageHeader, StatCard, TxAmount } from "@/components/shared";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { usePortfolio } from "@/hooks/use-portfolio";
import { formatCents, formatDate, formatMoney, formatPercent, formatSignedMoney } from "@/lib/format";
import type { DashboardPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [month, setMonth] = useState<string | null>(null);
  const { data, error, loading } = useApi<DashboardPayload>(`/api/dashboard${month ? `?month=${month}` : ""}`);
  const portfolio = usePortfolio();

  if (error && !data) return <ErrorNote message={error} />;
  if (!data) return <DashboardSkeleton />;

  const { summary, baseCurrency: cur, period } = data;
  const p = portfolio.data;

  return (
    <div className={cn("transition-opacity", loading && "opacity-70")}>
      <PageHeader
        title="Dashboard"
        description={`${formatDate(period.startDate)} – ${formatDate(period.endDate)}`}
        actions={<MonthPicker value={period.yearMonth} onChange={setMonth} />}
      />
      <RefreshWarning message={portfolio.warning} onDismiss={portfolio.dismissWarning} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Income"
          value={formatCents(summary.totalIncomeCents, cur)}
          icon={<ArrowUpRight className="size-4 text-emerald-600 dark:text-emerald-400" />}
        />
        <StatCard
          label="Expenses"
          value={formatCents(summary.totalExpenseCents, cur)}
          sub={`${formatCents(summary.fixedExpenseCents, cur)} fixed · ${formatCents(summary.variableExpenseCents, cur)} variable`}
          icon={<ArrowDownRight className="size-4 text-red-600 dark:text-red-400" />}
        />
        <StatCard
          label="Net cash flow"
          value={formatCents(summary.netCashFlowCents, cur)}
          tone={summary.netCashFlowCents > 0 ? "positive" : summary.netCashFlowCents < 0 ? "negative" : "neutral"}
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Savings rate"
          value={formatPercent(summary.savingsRatePercent)}
          sub={summary.savingsRatePercent === null ? "No income recorded" : "of income kept"}
          icon={<PiggyBank className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cash flow</CardTitle>
            <CardDescription>Income vs. expenses, last 6 periods</CardDescription>
          </CardHeader>
          <CardContent>
            <CashFlowBar data={data.monthlyTrend} currency={cur} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="size-4" /> Portfolio
            </CardTitle>
            <CardAction>
              <LastUpdated lastUpdated={p?.lastUpdated} refreshing={portfolio.refreshing} />
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-2">
            {!p ? (
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
            ) : p.holdings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No holdings yet.{" "}
                <Link href="/portfolio" className="underline underline-offset-4">
                  Add your first stock
                </Link>
              </p>
            ) : (
              <>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(p.summary.totalValueBase, p.baseCurrency)}</p>
                <p
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    p.summary.totalDayChangeBase > 0 ? "text-emerald-600 dark:text-emerald-400" : p.summary.totalDayChangeBase < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
                  )}
                >
                  {formatSignedMoney(p.summary.totalDayChangeBase, p.baseCurrency)} ({formatPercent(p.summary.totalDayChangePercent, 2, true)}) today
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.summary.holdingsCount} holding{p.summary.holdingsCount === 1 ? "" : "s"} ·{" "}
                  <Link href="/portfolio" className="underline underline-offset-4">
                    View portfolio
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={data.categoryBreakdown} currency={cur} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budgets</CardTitle>
            <CardAction>
              <Link href="/budgets" className="text-xs text-muted-foreground hover:text-foreground">
                Manage
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.budgetAlerts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No budgets set.{" "}
                <Link href="/budgets" className="underline underline-offset-4">
                  Set one up
                </Link>
              </p>
            ) : (
              <ul className="grid gap-3">
                {data.budgetAlerts.slice(0, 6).map((b) => (
                  <li key={b.categoryId} className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <CategoryIcon icon={b.icon} color={b.color} size="sm" />
                        <span className="truncate">{b.name}</span>
                      </span>
                      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatCents(b.spentCents, cur)} / {formatCents(b.budgetCents, cur)}
                      </span>
                    </div>
                    <BudgetBar percent={b.utilizationPercent} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <UpcomingBillsCard bills={data.upcomingBills} />
        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
            <CardAction>
              <Link href="/transactions" className="text-xs text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.recentTransactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No transactions yet. Press <kbd className="rounded border px-1 font-mono text-xs">Ctrl+K</kbd> to add one.
              </p>
            ) : (
              <ul className="grid gap-3">
                {data.recentTransactions.map((t) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <CategoryIcon icon={t.type === "TRANSFER" ? "transfer" : t.category?.icon} color={t.category?.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(t.date)} · {t.category?.name ?? "Transfer"}
                      </p>
                    </div>
                    <TxAmount cents={t.amountCents} currency={t.currency} type={t.type} className="text-sm" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
