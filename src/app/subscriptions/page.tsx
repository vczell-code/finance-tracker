"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { ConfirmDialog, EmptyState, ErrorNote, PageHeader, StatCard } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { apiFetch, emitDataChanged } from "@/lib/client";
import { FREQUENCY_LABELS, PAYMENT_METHOD_LABELS, formatCents, formatDate } from "@/lib/format";
import type { RecurringListPayload, RecurringRuleWithCategory, Settings } from "@/lib/types";

export default function SubscriptionsPage() {
  const { data, error } = useApi<RecurringListPayload>("/api/recurring");
  const { data: settings } = useApi<Settings>("/api/settings");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRuleWithCategory | null>(null);
  const [deleting, setDeleting] = useState<RecurringRuleWithCategory | null>(null);
  const [syncing, setSyncing] = useState(false);
  const cur = settings?.baseCurrency ?? "EUR";

  async function toggleActive(rule: RecurringRuleWithCategory, isActive: boolean) {
    try {
      await apiFetch(`/api/recurring/${rule.id}`, { method: "PATCH", json: { isActive } });
      toast.success(isActive ? `${rule.name} resumed` : `${rule.name} paused`);
      emitDataChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      const res = await apiFetch<{ generatedCount: number }>("/api/recurring/sync", { method: "POST" });
      toast.success(res.generatedCount ? `Logged ${res.generatedCount} due payment(s)` : "Everything is up to date");
      emitDataChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const expenses = data?.rules.filter((r) => r.type === "EXPENSE") ?? [];
  const income = data?.rules.filter((r) => r.type === "INCOME") ?? [];
  const activeCount = data?.rules.filter((r) => r.isActive && r.type === "EXPENSE").length ?? 0;

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Recurring bills and income are logged automatically when they fall due"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
              <RefreshCw className={syncing ? "animate-spin" : undefined} /> Sync now
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> Add recurring
            </Button>
          </>
        }
      />
      {error && <ErrorNote message={error} />}

      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Monthly fixed burn" value={formatCents(data.monthlyFixedExpenseCents, cur)} sub={`${activeCount} active bills`} />
          <StatCard label="Yearly fixed burn" value={formatCents(data.monthlyFixedExpenseCents * 12, cur)} />
          <StatCard label="Recurring income / mo" value={formatCents(data.monthlyFixedIncomeCents, cur)} />
          <StatCard
            label="Left after fixed costs"
            value={formatCents(data.monthlyFixedIncomeCents - data.monthlyFixedExpenseCents, cur)}
            tone={data.monthlyFixedIncomeCents - data.monthlyFixedExpenseCents >= 0 ? "positive" : "negative"}
            sub="per month"
          />
        </div>
      )}

      {!data ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : data.rules.length === 0 ? (
        <EmptyState
          title="No recurring items yet"
          description="Add rent, subscriptions or your salary once and they'll be logged automatically every period."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus /> Add recurring
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {[
            { title: "Bills & subscriptions", rules: expenses },
            { title: "Recurring income", rules: income },
          ]
            .filter((g) => g.rules.length > 0)
            .map((g) => (
              <section key={g.title}>
                <h2 className="mb-2 text-sm font-medium text-muted-foreground">{g.title}</h2>
                <Card>
                  <CardContent className="px-2 sm:px-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden sm:table-cell">Frequency</TableHead>
                          <TableHead>Next due</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="hidden text-right md:table-cell">Per month</TableHead>
                          <TableHead className="w-14">Active</TableHead>
                          <TableHead className="w-10">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.rules.map((r) => (
                          <TableRow key={r.id} className={r.isActive ? undefined : "opacity-60"}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CategoryIcon icon={r.category?.icon} color={r.category?.color} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{r.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {r.category?.name} · {PAYMENT_METHOD_LABELS[r.paymentMethod]}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="secondary">{FREQUENCY_LABELS[r.frequency]}</Badge>
                            </TableCell>
                            <TableCell className="tabular-nums">{r.isActive ? formatDate(r.nextDueDate) : "Paused"}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{formatCents(r.amountCents, r.currency)}</TableCell>
                            <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                              {formatCents(Math.round(r.monthlyCents), r.currency)}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={r.isActive}
                                onCheckedChange={(v) => toggleActive(r, v)}
                                aria-label={r.isActive ? `Pause ${r.name}` : `Resume ${r.name}`}
                              />
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
                                    <MoreHorizontal />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setEditing(r);
                                      setFormOpen(true);
                                    }}
                                  >
                                    <Pencil /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(r)}>
                                    <Trash2 /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </section>
            ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add recurring item"}</DialogTitle>
          </DialogHeader>
          {formOpen && <RecurringForm key={editing?.id ?? "new"} initial={editing ?? undefined} onDone={() => setFormOpen(false)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "rule"}?`}
        description="Future payments stop being logged. Transactions already recorded stay in your ledger."
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await apiFetch(`/api/recurring/${deleting.id}`, { method: "DELETE" });
            toast.success("Deleted");
            emitDataChanged();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
          }
        }}
      />
    </div>
  );
}
