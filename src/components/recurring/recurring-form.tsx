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
import { FREQUENCY_LABELS, PAYMENT_METHOD_LABELS, centsToInput, toCents } from "@/lib/format";
import type { Category, RecurringRule } from "@/lib/types";

export function RecurringForm({ initial, onDone }: { initial?: RecurringRule; onDone: () => void }) {
  const { data: categories } = useApi<Category[]>("/api/categories");
  const [type, setType] = useState<"EXPENSE" | "INCOME">(initial?.type ?? "EXPENSE");
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amountCents) : "");
  const [categoryId, setCategoryId] = useState(initial ? String(initial.categoryId) : "");
  const [frequency, setFrequency] = useState<string>(initial?.frequency ?? "MONTHLY");
  const [nextDueDate, setNextDueDate] = useState(initial?.nextDueDate ?? todayISODate());
  const [paymentMethod, setPaymentMethod] = useState<string>(initial?.paymentMethod ?? "BANK_TRANSFER");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const amountCents = toCents(amount);
    if (!name.trim()) errs.name = "Required";
    if (!Number.isFinite(amountCents) || amountCents <= 0) errs.amount = "Enter an amount greater than 0";
    if (!categoryId) errs.categoryId = "Pick a category";
    if (!nextDueDate) errs.nextDueDate = "Required";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      name: name.trim(),
      amountCents,
      type,
      categoryId: Number(categoryId),
      frequency,
      nextDueDate,
      paymentMethod,
      notes: notes.trim() || null,
    };
    setSaving(true);
    try {
      if (initial) {
        await apiFetch(`/api/recurring/${initial.id}`, { method: "PATCH", json: payload });
        toast.success("Subscription updated");
      } else {
        await apiFetch("/api/recurring", { method: "POST", json: payload });
        toast.success(
          nextDueDate <= todayISODate() ? "Subscription added — past-due payments were logged" : "Subscription added",
        );
      }
      emitDataChanged();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Tabs
        value={type}
        onValueChange={(v) => {
          setType(v as "EXPENSE" | "INCOME");
          setCategoryId("");
        }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="EXPENSE">Bill / Subscription</TabsTrigger>
          <TabsTrigger value="INCOME">Recurring income</TabsTrigger>
        </TabsList>
      </Tabs>
      <FormField label="Name" htmlFor="rr-name" error={errors.name}>
        <Input id="rr-name" autoFocus placeholder="e.g. Spotify" value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount" htmlFor="rr-amount" error={errors.amount}>
          <Input
            id="rr-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </FormField>
        <FormField label="Frequency" htmlFor="rr-frequency">
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger id="rr-frequency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FREQUENCY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Category" htmlFor="rr-category" error={errors.categoryId}>
        <CategorySelect
          id="rr-category"
          categories={(categories ?? []).filter((c) => c.type === type)}
          value={categoryId}
          onChange={setCategoryId}
          invalid={!!errors.categoryId}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Next due date"
          htmlFor="rr-date"
          error={errors.nextDueDate}
          hint="Its day-of-month is kept (e.g. 31st → 28th in Feb)"
        >
          <Input id="rr-date" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
        </FormField>
        <FormField label="Payment method" htmlFor="rr-method">
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger id="rr-method" className="w-full">
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
      <FormField label="Notes" htmlFor="rr-notes">
        <Textarea id="rr-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Add"}
        </Button>
      </div>
    </form>
  );
}
