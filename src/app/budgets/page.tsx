"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BudgetBar } from "@/components/budget-bar";
import { CategoryIcon } from "@/components/category-icon";
import { ErrorNote, MonthPicker, PageHeader, StatCard } from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/use-api";
import { apiFetch, emitDataChanged } from "@/lib/client";
import { centsToInput, formatCents, formatDate, formatPercent, toCents } from "@/lib/format";
import type { Category, DashboardPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

function StatusLabel({ percent }: { percent: number }) {
  if (percent >= 100)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
        <XCircle className="size-3.5" /> Over budget
      </span>
    );
  if (percent >= 80)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
        <AlertTriangle className="size-3.5" /> Nearly there
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
      <CheckCircle2 className="size-3.5" /> On track
    </span>
  );
}

function BudgetInput({ category, currency }: { category: Category; currency: string }) {
  const initial = category.monthlyBudgetCents ? centsToInput(category.monthlyBudgetCents) : "";
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value === initial) return;
    const cents = value.trim() === "" ? null : toCents(value);
    if (cents !== null && (!Number.isFinite(cents) || cents <= 0)) {
      toast.error("Budget must be greater than 0 (leave empty to remove)");
      setValue(initial);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/categories/${category.id}`, { method: "PATCH", json: { monthlyBudgetCents: cents } });
      toast.success(cents ? `${category.name} budget set to ${formatCents(cents, currency)}` : `${category.name} budget removed`);
      emitDataChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save budget");
      setValue(initial);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Input
      type="number"
      inputMode="decimal"
      min="0"
      step="1"
      placeholder="No budget"
      className="h-8 w-28 text-right tabular-nums"
      value={value}
      disabled={saving}
      aria-label={`Monthly budget for ${category.name}`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setValue(initial);
      }}
    />
  );
}

export default function BudgetsPage() {
  const [month, setMonth] = useState<string | null>(null);
  const { data, error } = useApi<DashboardPayload>(`/api/dashboard${month ? `?month=${month}` : ""}`);
  const { data: categories } = useApi<Category[]>("/api/categories");

  if (error && !data) return <ErrorNote message={error} />;
  if (!data || !categories) return <div className="h-96 animate-pulse rounded-xl bg-muted" />;

  const cur = data.baseCurrency;
  const spent = new Map(data.categoryBreakdown.map((c) => [c.categoryId, c.amountCents]));
  const expenseCats = categories.filter((c) => c.type === "EXPENSE");
  const totalBudget = data.budgetAlerts.reduce((s, b) => s + b.budgetCents, 0);
  const totalSpentBudgeted = data.budgetAlerts.reduce((s, b) => s + b.spentCents, 0);
  const overCount = data.budgetAlerts.filter((b) => b.utilizationPercent >= 100).length;

  const groups = new Map<string, Category[]>();
  for (const c of expenseCats) groups.set(c.groupName, [...(groups.get(c.groupName) ?? []), c]);

  return (
    <div>
      <PageHeader
        title="Budgets"
        description={`${formatDate(data.period.startDate)} – ${formatDate(data.period.endDate)} · type a monthly limit next to any category`}
        actions={<MonthPicker value={data.period.yearMonth} onChange={setMonth} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total budgeted" value={formatCents(totalBudget, cur)} sub={`${data.budgetAlerts.length} ${data.budgetAlerts.length === 1 ? "category" : "categories"}`} />
        <StatCard label="Spent (budgeted)" value={formatCents(totalSpentBudgeted, cur)} sub={totalBudget ? `${formatPercent((totalSpentBudgeted / totalBudget) * 100, 0)} used` : undefined} />
        <StatCard
          label="Remaining"
          value={formatCents(totalBudget - totalSpentBudgeted, cur)}
          tone={totalBudget - totalSpentBudgeted < 0 ? "negative" : "neutral"}
        />
        <StatCard label="Over budget" value={overCount} tone={overCount > 0 ? "negative" : "neutral"} sub={overCount === 1 ? "category" : "categories"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[...groups.entries()].map(([group, cats]) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle>{group}</CardTitle>
              <CardDescription>{cats.some((c) => c.isFixed) ? "Fixed costs" : "Variable spending"}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-4">
                {cats.map((c) => {
                  const s = spent.get(c.id) ?? 0;
                  const pct = c.monthlyBudgetCents ? (s / c.monthlyBudgetCents) * 100 : null;
                  return (
                    <li key={c.id} className="grid gap-1.5">
                      <div className="flex items-center gap-2">
                        <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                        <span className={cn("text-sm tabular-nums", pct !== null && pct >= 100 && "text-red-600")}>
                          {formatCents(s, cur)}
                        </span>
                        <span className="text-xs text-muted-foreground">/</span>
                        <BudgetInput key={`${c.id}-${c.monthlyBudgetCents}`} category={c} currency={cur} />
                      </div>
                      {pct !== null && (
                        <div className="grid gap-1 pl-8">
                          <BudgetBar percent={pct} />
                          <div className="flex justify-between">
                            <StatusLabel percent={pct} />
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {c.monthlyBudgetCents! - s >= 0
                                ? `${formatCents(c.monthlyBudgetCents! - s, cur)} left`
                                : `${formatCents(s - c.monthlyBudgetCents!, cur)} over`}
                            </span>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
