"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ApiError, apiFetch, emitDataChanged } from "@/lib/client";
import { isValidISODate } from "@/lib/dates";
import { parseCsvObjects } from "@/services/csv.service";

type Row = {
  date: string;
  amountCents: number;
  currency?: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  category: string | null;
  merchant: string;
  paymentMethod: string;
  notes: string | null;
};

const METHODS = new Set(["DEBIT", "CREDIT", "BANK_TRANSFER", "CASH", "OTHER"]);

/** Accepts the app's own export format; also tolerates signed amounts without a `type` column. */
function mapRows(objs: Record<string, string>[]): { rows: Row[]; errors: string[] } {
  const rows: Row[] = [];
  const errors: string[] = [];
  objs.forEach((o, i) => {
    const line = i + 2;
    const date = o.date ?? "";
    const raw = Number((o.amount ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
    let type = (o.type ?? "").toUpperCase() as Row["type"];
    if (!["INCOME", "EXPENSE", "TRANSFER"].includes(type)) type = raw < 0 ? "EXPENSE" : "INCOME";
    const merchant = o.merchant || o.payee || o.description || "";
    const method = (o.paymentmethod ?? "").toUpperCase();
    if (!isValidISODate(date)) return errors.push(`Line ${line}: date must be YYYY-MM-DD`);
    if (!Number.isFinite(raw) || raw === 0) return errors.push(`Line ${line}: invalid amount`);
    if (!merchant) return errors.push(`Line ${line}: merchant is required`);
    if (type !== "TRANSFER" && !o.category) return errors.push(`Line ${line}: category is required`);
    rows.push({
      date,
      amountCents: Math.round(Math.abs(raw) * 100),
      currency: /^[A-Z]{3}$/.test(o.currency ?? "") ? o.currency : undefined,
      type,
      category: o.category || null,
      merchant,
      paymentMethod: METHODS.has(method) ? method : "DEBIT",
      notes: o.notes || null,
    });
  });
  return { rows, errors };
}

export function CsvImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ name: string; rows: Row[]; errors: string[] } | null>(null);
  const [createMissing, setCreateMissing] = useState(true);
  const [importing, setImporting] = useState(false);

  async function onFile(file: File) {
    const text = await file.text();
    setPreview({ name: file.name, ...mapRows(parseCsvObjects(text)) });
  }

  async function doImport() {
    if (!preview?.rows.length) return;
    setImporting(true);
    try {
      const res = await apiFetch<{ importedCount: number; createdCategories: string[] }>("/api/import/csv", {
        method: "POST",
        json: { rows: preview.rows, createMissingCategories: createMissing },
      });
      toast.success(
        `Imported ${res.importedCount} transactions` +
          (res.createdCategories.length ? ` · created ${res.createdCategories.length} categories` : ""),
      );
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      emitDataChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Import failed — nothing was imported");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Columns: <code className="text-xs">date, type, amount, currency, category, merchant, paymentMethod, notes</code> (same
        as the export). All rows are imported in one go — if any row fails, nothing is saved.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload /> Choose CSV file
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={createMissing} onCheckedChange={setCreateMissing} /> Create missing categories
        </label>
      </div>
      {preview && (
        <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <p>
            <span className="font-medium">{preview.name}</span>: {preview.rows.length} valid row(s)
            {preview.errors.length > 0 && <span className="text-destructive"> · {preview.errors.length} skipped</span>}
          </p>
          {preview.errors.length > 0 && (
            <ul className="max-h-24 overflow-auto text-xs text-destructive">
              {preview.errors.slice(0, 20).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={doImport} disabled={importing || preview.rows.length === 0}>
              {importing ? "Importing…" : `Import ${preview.rows.length} rows`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
