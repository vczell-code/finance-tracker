"use client";

import { SERIES_COLORS } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { EnrichedHolding } from "@/lib/types";
import { Donut, foldSlices } from "./donut";

/** Allocation by holding. Colours are assigned by ticker (alphabetical) so they never repaint with value changes. */
export function AllocationDonut({ holdings, currency }: { holdings: EnrichedHolding[]; currency: string }) {
  const valued = holdings.filter((h) => (h.baseMarketValue ?? 0) > 0);
  if (valued.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No priced holdings yet.</p>;
  }
  const sorted = [...valued].sort((a, b) => b.baseMarketValue! - a.baseMarketValue!);
  // Only the slices actually shown get a categorical slot (max 8, the rest fold into "Other").
  const shown = sorted.length <= SERIES_COLORS.length ? sorted : sorted.slice(0, SERIES_COLORS.length - 1);
  const colorByTicker = new Map(
    shown
      .map((h) => h.ticker)
      .sort()
      .map((t, i) => [t, SERIES_COLORS[i]]),
  );
  const slices = foldSlices(
    sorted.map((h) => ({ key: h.ticker, label: h.ticker, value: h.baseMarketValue!, color: colorByTicker.get(h.ticker)! })),
    8,
  );
  const total = valued.reduce((s, h) => s + h.baseMarketValue!, 0);
  return (
    <Donut
      slices={slices}
      formatValue={(v) => formatMoney(v, currency)}
      centerLabel="Total"
      centerValue={formatMoney(total, currency, 0)}
      ariaLabel="Portfolio allocation by holding"
    />
  );
}
