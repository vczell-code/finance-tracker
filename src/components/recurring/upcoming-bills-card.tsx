"use client";

import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayISODate } from "@/lib/dates";
import { FREQUENCY_LABELS, formatCents, formatDate } from "@/lib/format";
import type { DashboardPayload } from "@/lib/types";

function daysUntil(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [ty, tm, td] = todayISODate().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

export function UpcomingBillsCard({ bills }: { bills: DashboardPayload["upcomingBills"] }) {
  const total = bills.reduce((s, b) => s + b.amountCents, 0);
  const currency = bills[0]?.currency ?? "EUR";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming bills</CardTitle>
        <CardAction>
          <Link href="/subscriptions" className="text-xs text-muted-foreground hover:text-foreground">
            Manage
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing due in the next 30 days.</p>
        ) : (
          <>
            <ul className="grid gap-3">
              {bills.map((b) => {
                const d = daysUntil(b.nextDueDate);
                return (
                  <li key={b.id} className="flex items-center gap-3">
                    <CategoryIcon icon={b.categoryIcon} color={b.categoryColor} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(b.nextDueDate)} · {d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`} ·{" "}
                        {FREQUENCY_LABELS[b.frequency]}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">{formatCents(b.amountCents, b.currency)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 border-t pt-3 text-right text-xs text-muted-foreground">
              Total next 30 days: <span className="font-medium text-foreground">{formatCents(total, currency)}</span>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
