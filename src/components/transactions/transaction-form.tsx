"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CategorySelect } from "@/components/category-select";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { apiFetch, emitDataChanged } from "@/lib/client";
import { todayISODate } from "@/lib/dates";
import { PAYMENT_METHOD_LABELS, centsToInput, toCents } from "@/lib/format";
import type { Category, Transaction } from "@/lib/types";

type TxType = "EXPENSE" | "INCOME" | "TRANSFER";

export function TransactionForm({
  initial,
  onDone,
  autoFocus = true,
}: {
  initial?: Transaction;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const { data: categories } = useApi<Category[]>("/api/categories");
  const [type, setType] = useState<TxType>(initial?.type ?? "EXPENSE");
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amountCents) : "");
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ? String(initial.categoryId) : "");
  const [date, setDate] = useState(initial?.date ?? todayISODate());
  const [paymentMethod, setPaymentMethod] = useState<string>(initial?.paymentMethod ?? "DEBIT");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const visibleCategories = (categories ?? []).filter((c) => (type === "TRANSFER" ? false : c.type === type));

  function changeType(t: TxType) {
    setType(t);
    const current = categories?.find((c) => String(c.id) === categoryId);
    if (current && current.type !== t) setCategoryId("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const amountCents = toCents(amount);
    if (!Number.isFinite(amountCents) || amountCents <= 0) errs.amount = "Enter an amount greater than 0";
    if (!merchant.trim()) errs.merchant = "Required";
    if (type !== "TRANSFER" && !categoryId) errs.categoryId = "Pick a category";
    if (!date) errs.date = "Required";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      date,
      amountCents,
      type,
      categoryId: type === "TRANSFER" ? null : Number(categoryId),
      merchant: merchant.trim(),
      paymentMethod,
      notes: notes.trim() || null,
    };
    setSaving(true);
    try {
      if (initial) {
        await apiFetch(`/api/transactions/${initial.id}`, { method: "PATCH", json: payload });
        toast.success("Transaction updated");
      } else {
        await apiFetch("/api/transactions", { method: "POST", json: payload });
        toast.success(`${type === "INCOME" ? "Income" : type === "TRANSFER" ? "Transfer" : "Expense"} added`);
      }
      emitDataChanged();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save transaction");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Tabs value={type} onValueChange={(v) => changeType(v as TxType)}>
        <TabsList className="w-full">
          <TabsTrigger value="EXPENSE">Expense</TabsTrigger>
          <TabsTrigger value="INCOME">Income</TabsTrigger>
          <TabsTrigger value="TRANSFER">Transfer</TabsTrigger>
        </TabsList>
      </Tabs>

      <FormField label="Amount" htmlFor="tx-amount" error={errors.amount}>
          <Input
            id="tx-amount"
            inputMode="decimal"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            autoFocus={autoFocus}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!errors.amount || undefined}
          />
        </FormField>

      <FormField label={type === "INCOME" ? "Source" : type === "TRANSFER" ? "Description" : "Merchant"} htmlFor="tx-merchant" error={errors.merchant}>
        <Input
          id="tx-merchant"
          placeholder={type === "INCOME" ? "e.g. Employer" : type === "TRANSFER" ? "e.g. To savings account" : "e.g. Supermarket"}
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          aria-invalid={!!errors.merchant || undefined}
        />
      </FormField>

      {type !== "TRANSFER" && (
        <FormField label="Category" htmlFor="tx-category" error={errors.categoryId}>
          <CategorySelect
            id="tx-category"
            categories={visibleCategories}
            value={categoryId}
            onChange={setCategoryId}
            invalid={!!errors.categoryId}
          />
        </FormField>
      )}

      <div className="grid grid-cols-2 gap-3">
      <FormField label="Date" htmlFor="tx-date" error={errors.date}>
        <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </FormField>
      <FormField label="Payment method" htmlFor="tx-method">
        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger id="tx-method" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      </div>

      <FormField label="Notes" htmlFor="tx-notes">
        <Textarea id="tx-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </FormField>

      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Save"}
        </Button>
      </div>
    </form>
  );
}
