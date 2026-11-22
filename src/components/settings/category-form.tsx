"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CATEGORY_ICONS, CategoryIcon } from "@/components/category-icon";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiFetch, emitDataChanged } from "@/lib/client";
import { centsToInput, toCents } from "@/lib/format";
import type { Category } from "@/lib/types";

const ICON_NAMES = Object.keys(CATEGORY_ICONS).filter((k) => k !== "transfer");

export function CategoryForm({ initial, groups, onDone }: { initial?: Category; groups: string[]; onDone: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<"EXPENSE" | "INCOME">(initial?.type ?? "EXPENSE");
  const [groupName, setGroupName] = useState(initial?.groupName ?? "");
  const [isFixed, setIsFixed] = useState(initial?.isFixed ?? false);
  const [color, setColor] = useState(initial?.color ?? "#3b82f6");
  const [icon, setIcon] = useState(initial?.icon ?? "tag");
  const [budget, setBudget] = useState(initial?.monthlyBudgetCents ? centsToInput(initial.monthlyBudgetCents) : "");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Required";
    if (!groupName.trim()) errs.groupName = "Required";
    const budgetCents = budget.trim() ? toCents(budget) : null;
    if (budgetCents !== null && (!Number.isFinite(budgetCents) || budgetCents <= 0)) errs.budget = "Must be greater than 0";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = { name: name.trim(), type, groupName: groupName.trim(), isFixed, color, icon, monthlyBudgetCents: budgetCents };
    setSaving(true);
    try {
      if (initial) await apiFetch(`/api/categories/${initial.id}`, { method: "PATCH", json: payload });
      else await apiFetch("/api/categories", { method: "POST", json: payload });
      toast.success(initial ? "Category updated" : "Category created");
      emitDataChanged();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="flex items-end gap-3">
        <CategoryIcon icon={icon} color={color} />
        <FormField label="Name" htmlFor="c-name" error={errors.name} className="flex-1">
          <Input id="c-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Type" htmlFor="c-type">
          <Select value={type} onValueChange={(v) => setType(v as "EXPENSE" | "INCOME")} disabled={!!initial}>
            <SelectTrigger id="c-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">Expense</SelectItem>
              <SelectItem value="INCOME">Income</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Group" htmlFor="c-group" error={errors.groupName}>
          <Input id="c-group" list="c-groups" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Food" />
          <datalist id="c-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Icon" htmlFor="c-icon">
          <Select value={icon} onValueChange={setIcon}>
            <SelectTrigger id="c-icon" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ICON_NAMES.map((i) => (
                <SelectItem key={i} value={i}>
                  <CategoryIcon icon={i} color={color} size="sm" />
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Colour" htmlFor="c-color">
          <Input id="c-color" type="color" className="h-8 p-1" value={color} onChange={(e) => setColor(e.target.value)} />
        </FormField>
      </div>
      {type === "EXPENSE" && (
        <div className="grid grid-cols-2 items-end gap-3">
          <FormField label="Monthly budget" htmlFor="c-budget" error={errors.budget}>
            <Input
              id="c-budget"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="None"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </FormField>
          <label className="flex h-8 items-center gap-2 text-sm">
            <Switch checked={isFixed} onCheckedChange={setIsFixed} /> Fixed cost
          </label>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}
