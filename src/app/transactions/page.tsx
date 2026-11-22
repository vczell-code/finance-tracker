"use client";

import { useDeferredValue, useState } from "react";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQuickAdd } from "@/components/layout/quick-add-command-dialog";
import { ConfirmDialog, EmptyState, ErrorNote, PageHeader } from "@/components/shared";
import { EMPTY_FILTERS, FilterBar, type TransactionFilters } from "@/components/transactions/filter-bar";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApi } from "@/hooks/use-api";
import { apiFetch, emitDataChanged } from "@/lib/client";
import type { Category, TransactionWithCategory } from "@/lib/types";

const PAGE_SIZE = 50;

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const deferred = useDeferredValue(filters);
  const { open: openQuickAdd } = useQuickAdd();
  const [editing, setEditing] = useState<TransactionWithCategory | null>(null);
  const [deleting, setDeleting] = useState<TransactionWithCategory | null>(null);

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(deferred)) if (v) params.set(k, v);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));

  const { data, error, loading } = useApi<{ items: TransactionWithCategory[]; total: number }>(`/api/transactions?${params}`);
  const { data: categories } = useApi<Category[]>("/api/categories");

  const changeFilters = (f: TransactionFilters) => {
    setFilters(f);
    setPage(0);
  };

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiFetch(`/api/transactions/${deleting.id}`, { method: "DELETE" });
      toast.success("Transaction deleted");
      emitDataChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Income, expenses and transfers"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/csv?type=transactions">
                <Download /> Export CSV
              </a>
            </Button>
            <Button size="sm" onClick={openQuickAdd}>
              <Plus /> New
            </Button>
          </>
        }
      />
      <FilterBar value={filters} onChange={changeFilters} categories={categories ?? []} />

      {error && <ErrorNote message={error} />}
      {!data ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : data.items.length === 0 ? (
        <EmptyState
          title={Object.values(filters).some(Boolean) ? "No matching transactions" : "No transactions yet"}
          description="Add one with the button above or press Ctrl+K anywhere."
          action={
            <Button onClick={openQuickAdd}>
              <Plus /> Add transaction
            </Button>
          }
        />
      ) : (
        <Card className={loading ? "opacity-70" : undefined}>
          <CardContent className="px-2 sm:px-4">
            <TransactionTable items={data.items} onEdit={setEditing} onDelete={setDeleting} />
          </CardContent>
        </Card>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit transaction</DialogTitle>
          </DialogHeader>
          {editing && <TransactionForm key={editing.id} initial={editing} autoFocus={false} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete transaction?"
        description={deleting ? `"${deleting.merchant}" will be permanently removed.` : undefined}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
