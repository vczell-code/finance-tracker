"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Download, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { FormField } from "@/components/form-field";
import { CategoryForm } from "@/components/settings/category-form";
import { CsvImport } from "@/components/settings/csv-import";
import { ConfirmDialog, PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApi } from "@/hooks/use-api";
import { ApiError, apiFetch, emitDataChanged } from "@/lib/client";
import { formatCents } from "@/lib/format";
import type { Category, Settings } from "@/lib/types";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];

export default function SettingsPage() {
  const { data: settings } = useApi<Settings>("/api/settings");
  const [showArchived, setShowArchived] = useState(false);
  const { data: categories } = useApi<Category[]>(`/api/categories${showArchived ? "?includeArchived=true" : ""}`);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  async function saveSettings(patch: Partial<Pick<Settings, "baseCurrency" | "monthStartDay">>) {
    try {
      await apiFetch("/api/settings", { method: "PATCH", json: patch });
      toast.success("Settings saved");
      emitDataChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
    }
  }

  async function setArchived(c: Category, isArchived: boolean) {
    try {
      await apiFetch(`/api/categories/${c.id}`, { method: "PATCH", json: { isArchived } });
      toast.success(isArchived ? `${c.name} archived` : `${c.name} restored`);
      emitDataChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiFetch(`/api/categories/${deleting.id}`, { method: "DELETE" });
      toast.success(`${deleting.name} deleted`);
      emitDataChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const c = deleting;
        toast.error(e.message, { action: { label: "Archive", onClick: () => setArchived(c, true) } });
      } else {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    }
  }

  const groups = [...new Set((categories ?? []).map((c) => c.groupName))];
  const byType = (t: "EXPENSE" | "INCOME") => (categories ?? []).filter((c) => c.type === t);

  return (
    <div className="grid gap-6">
      <PageHeader title="Settings" description="Preferences, categories and data" />

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Cash flow and portfolio values are shown in your base currency.</CardDescription>
        </CardHeader>
        <CardContent>
          {!settings ? (
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Base currency" htmlFor="s-currency" hint="Portfolio values are converted automatically. Cash-flow totals only count transactions recorded in the base currency.">
                <Select value={settings.baseCurrency} onValueChange={(v) => saveSettings({ baseCurrency: v })}>
                  <SelectTrigger id="s-currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="Month starts on day"
                htmlFor="s-start"
                hint="E.g. 25 if you're paid on the 25th — periods then run 25th → 24th."
              >
                <Select value={String(settings.monthStartDay)} onValueChange={(v) => saveSettings({ monthStartDay: Number(v) })}>
                  <SelectTrigger id="s-start" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d === 1 ? "1 (calendar month)" : d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Categories in use can be archived to keep history intact.</CardDescription>
          <CardAction className="flex items-center gap-3">
            <label className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} size="sm" /> Show archived
            </label>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> New
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          {(["EXPENSE", "INCOME"] as const).map((t) => (
            <div key={t}>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t === "EXPENSE" ? "Expenses" : "Income"}
              </h3>
              <ul className="divide-y rounded-lg border">
                {byType(t).map((c) => (
                  <li key={c.id} className={`flex items-center gap-3 px-3 py-2 ${c.isArchived ? "opacity-50" : ""}`}>
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.groupName}
                        {c.monthlyBudgetCents ? ` · budget ${formatCents(c.monthlyBudgetCents, settings?.baseCurrency)}` : ""}
                      </p>
                    </div>
                    {c.isFixed && <Badge variant="secondary">Fixed</Badge>}
                    {c.isArchived && <Badge variant="outline">Archived</Badge>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(c);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setArchived(c, !c.isArchived)}>
                          {c.isArchived ? <ArchiveRestore /> : <Archive />} {c.isArchived ? "Restore" : "Archive"}
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import &amp; export</CardTitle>
          <CardDescription>RFC-4180 CSV files, compatible with any spreadsheet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/csv?type=transactions">
                <Download /> Export transactions
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/csv?type=holdings">
                <Download /> Export holdings
              </a>
            </Button>
          </div>
          <CsvImport />
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "New category"}</DialogTitle>
          </DialogHeader>
          {formOpen && (
            <CategoryForm key={editing?.id ?? "new"} initial={editing ?? undefined} groups={groups} onDone={() => setFormOpen(false)} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "category"}?`}
        description="Only possible if no transactions or recurring rules use it. Otherwise, archive it instead."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
