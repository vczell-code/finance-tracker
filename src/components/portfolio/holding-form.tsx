"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, emitDataChanged } from "@/lib/client";
import type { Holding, TickerSearchResult } from "@/lib/types";
import { TickerSearchCombobox } from "./ticker-search-combobox";

export function HoldingForm({ initial, onDone }: { initial?: Holding; onDone: () => void }) {
  const [ticker, setTicker] = useState<TickerSearchResult | null>(null);
  const [shares, setShares] = useState(initial ? String(initial.shares) : "");
  const [avgCost, setAvgCost] = useState(initial?.avgCostPerShare != null ? String(initial.avgCostPerShare) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const sharesNum = Number(shares);
    const costNum = avgCost.trim() === "" ? null : Number(avgCost);
    if (!initial && !ticker) errs.ticker = "Pick a ticker";
    if (!Number.isFinite(sharesNum) || sharesNum <= 0) errs.shares = "Must be greater than 0";
    if (costNum !== null && (!Number.isFinite(costNum) || costNum <= 0)) errs.avgCost = "Must be greater than 0 (or empty)";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      if (initial) {
        await apiFetch(`/api/portfolio/holdings/${initial.id}`, {
          method: "PATCH",
          json: { shares: sharesNum, avgCostPerShare: costNum, notes: notes.trim() || null },
        });
        toast.success(`${initial.ticker} updated`);
      } else {
        const h = await apiFetch<Holding>("/api/portfolio/holdings", {
          method: "POST",
          json: { ticker: ticker!.ticker, shares: sharesNum, avgCostPerShare: costNum, notes: notes.trim() || null },
        });
        toast.success(`${h.ticker} added to portfolio`);
      }
      emitDataChanged();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save holding");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {initial ? (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-medium">{initial.ticker}</span> <span className="text-muted-foreground">· {initial.name}</span>
        </div>
      ) : (
        <FormField label="Stock / ETF" htmlFor="h-ticker" error={errors.ticker} hint="Yahoo Finance symbol, e.g. AAPL, VWCE.DE, VUSA.L">
          <TickerSearchCombobox id="h-ticker" value={ticker} onChange={setTicker} invalid={!!errors.ticker} />
        </FormField>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Shares" htmlFor="h-shares" error={errors.shares}>
          <Input
            id="h-shares"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            placeholder="0"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            autoFocus={!!initial}
          />
        </FormField>
        <FormField
          label={`Avg. cost / share${initial ? ` (${initial.currency})` : ""}`}
          htmlFor="h-cost"
          error={errors.avgCost}
          hint={initial ? undefined : "In the stock's trading currency. Optional"}
        >
          <Input
            id="h-cost"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            placeholder="Optional"
            value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
          />
        </FormField>
      </div>
      <FormField label="Notes" htmlFor="h-notes">
        <Textarea id="h-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (initial ? "Saving…" : "Looking up…") : initial ? "Save changes" : "Add holding"}
        </Button>
      </div>
    </form>
  );
}
