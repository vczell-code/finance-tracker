"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SERIES_COLORS } from "@/lib/client";
import { formatCents, formatYearMonth } from "@/lib/format";

const INCOME = SERIES_COLORS[0];
const EXPENSE = SERIES_COLORS[1];

export function CashFlowBar({
  data,
  currency,
}: {
  data: { yearMonth: string; incomeCents: number; expenseCents: number }[];
  currency: string;
}) {
  const rows = data.map((d) => ({ ...d, label: formatYearMonth(d.yearMonth) }));
  const compact = new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
  return (
    <div className="h-64 w-full" role="img" aria-label="Income and expenses over the last six months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} tick={{ fill: "var(--muted-foreground)" }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={56}
            tick={{ fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) => compact.format(v / 100)}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            formatter={(v, name) => [formatCents(Number(v), currency), name]}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--popover)", color: "var(--popover-foreground)" }}
            itemStyle={{ color: "var(--popover-foreground)" }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
          <Bar dataKey="incomeCents" name="Income" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="expenseCents" name="Expenses" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
