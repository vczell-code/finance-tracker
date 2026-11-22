"use client";

import { formatCents } from "@/lib/format";
import type { CategorySpend } from "@/lib/types";
import { Donut, foldSlices } from "./donut";

/** Spending by category — slices keep each category's own colour (colour follows the entity). */
export function CategoryDonut({ data, currency }: { data: CategorySpend[]; currency: string }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No expenses in this period yet.</p>;
  }
  const total = data.reduce((s, c) => s + c.amountCents, 0);
  const slices = foldSlices(
    data.map((c) => ({ key: String(c.categoryId), label: c.name, value: c.amountCents, color: c.color })),
  );
  return (
    <Donut
      slices={slices}
      formatValue={(v) => formatCents(v, currency)}
      centerLabel="Spent"
      centerValue={formatCents(total, currency)}
      ariaLabel="Spending by category"
    />
  );
}
