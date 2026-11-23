"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { OTHER_COLOR } from "@/lib/client";
import { formatPercent } from "@/lib/format";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Fold everything past `max - 1` slices into a neutral "Other" slice. */
export function foldSlices(slices: DonutSlice[], max = 7): DonutSlice[] {
  if (slices.length <= max) return slices;
  const head = slices.slice(0, max - 1);
  const rest = slices.slice(max - 1).reduce((s, x) => s + x.value, 0);
  return [...head, { key: "other", label: "Other", value: rest, color: OTHER_COLOR }];
}

/** Donut with center total, hover tooltip and a legend (names + share) beside it. */
export function Donut({
  slices,
  formatValue,
  centerLabel,
  centerValue,
  ariaLabel,
}: {
  slices: DonutSlice[];
  formatValue: (v: number) => string;
  centerLabel: string;
  centerValue: string;
  ariaLabel: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative size-44 shrink-0" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={slices.length > 1 ? 1.5 : 0}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, name) => [`${formatValue(Number(v))} · ${formatPercent((Number(v) / total) * 100)}`, name]}
              contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--popover)", color: "var(--popover-foreground)" }}
            itemStyle={{ color: "var(--popover-foreground)" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
          <span className="text-sm font-semibold tabular-nums">{centerValue}</span>
        </div>
      </div>
      <ul className="grid w-full min-w-0 gap-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="text-muted-foreground tabular-nums">{formatPercent(total > 0 ? (s.value / total) * 100 : 0, 0)}</span>
            <span className="w-24 text-right font-medium tabular-nums">{formatValue(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
