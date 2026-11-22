"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { HoldingForm } from "@/components/portfolio/holding-form";
import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { LastUpdated, RefreshWarning } from "@/components/portfolio/portfolio-status";
import { ConfirmDialog, EmptyState, ErrorNote, PageHeader, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePortfolio } from "@/hooks/use-portfolio";
import { apiFetch, emitDataChanged } from "@/lib/client";
import { formatMoney, formatPercent, formatSignedMoney } from "@/lib/format";
import type { EnrichedHolding } from "@/lib/types";

export default function PortfolioPage() {
  const { data, error, refreshing, refresh, warning, dismissWarning } = usePortfolio();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EnrichedHolding | null>(null);
  const [deleting, setDeleting] = useState<EnrichedHolding | null>(null);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  if (error && !data) return <ErrorNote message={error} />;

  const s = data?.summary;
  const cur = data?.baseCurrency ?? "EUR";
  const dayTone = s ? (s.totalDayChangeBase > 0 ? "positive" : s.totalDayChangeBase < 0 ? "negative" : "neutral") : undefined;
  const pnlTone = s?.totalUnrealizedPnlBase ? (s.totalUnrealizedPnlBase > 0 ? "positive" : "negative") : "neutral";

  return (
    <div>
      <PageHeader
        title="Portfolio"
        description={<LastUpdated lastUpdated={data?.lastUpdated} refreshing={refreshing} onRefresh={() => refresh(true)} />}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/csv?type=holdings">
                <Download /> Export CSV
              </a>
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus /> Add holding
            </Button>
          </>
        }
      />
      <RefreshWarning message={warning} onDismiss={dismissWarning} />

      {!data ? (
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      ) : data.holdings.length === 0 ? (
        <EmptyState
          title="No holdings yet"
          description="Search for any stock, ETF or fund on Yahoo Finance. Prices refresh automatically from end-of-day data."
          action={
            <Button onClick={openAdd}>
              <Plus /> Add holding
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total value" value={formatMoney(s!.totalValueBase, cur)} sub={`${s!.holdingsCount} holdings`} />
            <StatCard
              label="Today"
              value={formatSignedMoney(s!.totalDayChangeBase, cur)}
              sub={formatPercent(s!.totalDayChangePercent, 2, true)}
              tone={dayTone}
            />
            <StatCard
              label="Unrealized P&L"
              value={formatSignedMoney(s!.totalUnrealizedPnlBase, cur)}
              sub={
                s!.totalCostBasisBase
                  ? `${formatPercent((s!.totalUnrealizedPnlBase! / s!.totalCostBasisBase) * 100, 1, true)} on holdings with cost basis`
                  : "Add avg. cost to track"
              }
              tone={pnlTone}
            />
            <StatCard label="Cost basis" value={formatMoney(s!.totalCostBasisBase, cur)} sub="where tracked" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="px-2 sm:px-4">
                <HoldingsTable
                  holdings={data.holdings}
                  baseCurrency={cur}
                  onEdit={(h) => {
                    setEditing(h);
                    setFormOpen(true);
                  }}
                  onDelete={setDeleting}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <AllocationDonut holdings={data.holdings} currency={cur} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.ticker}` : "Add holding"}</DialogTitle>
            {!editing && <DialogDescription>The ticker is validated against Yahoo Finance.</DialogDescription>}
          </DialogHeader>
          {formOpen && <HoldingForm key={editing?.id ?? "new"} initial={editing ?? undefined} onDone={() => setFormOpen(false)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove ${deleting?.ticker ?? "holding"}?`}
        description="The holding and its cached price will be removed."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await apiFetch(`/api/portfolio/holdings/${deleting.id}`, { method: "DELETE" });
            toast.success(`${deleting.ticker} removed`);
            emitDataChanged();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Remove failed");
          }
        }}
      />
    </div>
  );
}
