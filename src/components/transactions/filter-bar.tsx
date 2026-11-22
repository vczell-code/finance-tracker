"use client";

import { Search, X } from "lucide-react";
import { CategorySelect } from "@/components/category-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_METHOD_LABELS } from "@/lib/format";
import type { Category } from "@/lib/types";

export interface TransactionFilters {
  search: string;
  type: string;
  categoryId: string;
  paymentMethod: string;
  startDate: string;
  endDate: string;
}

export const EMPTY_FILTERS: TransactionFilters = {
  search: "",
  type: "",
  categoryId: "",
  paymentMethod: "",
  startDate: "",
  endDate: "",
};

export function FilterBar({
  value,
  onChange,
  categories,
}: {
  value: TransactionFilters;
  onChange: (f: TransactionFilters) => void;
  categories: Category[];
}) {
  const set = <K extends keyof TransactionFilters>(k: K, v: TransactionFilters[K]) => onChange({ ...value, [k]: v });
  const active = Object.values(value).some(Boolean);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-56">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search merchant or notes"
          className="pl-8"
          value={value.search}
          onChange={(e) => set("search", e.target.value)}
          aria-label="Search transactions"
        />
      </div>
      <Select value={value.type || "all"} onValueChange={(v) => onChange({ ...value, type: v === "all" ? "" : v, categoryId: "" })}>
        <SelectTrigger className="w-32" aria-label="Type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="EXPENSE">Expenses</SelectItem>
          <SelectItem value="INCOME">Income</SelectItem>
          <SelectItem value="TRANSFER">Transfers</SelectItem>
        </SelectContent>
      </Select>
      {value.type !== "TRANSFER" && (
        <CategorySelect
          categories={value.type ? categories.filter((c) => c.type === value.type) : categories}
          value={value.categoryId}
          onChange={(v) => set("categoryId", v)}
          allowAll="All categories"
          className="w-48"
        />
      )}
      <Select value={value.paymentMethod || "all"} onValueChange={(v) => set("paymentMethod", v === "all" ? "" : v)}>
        <SelectTrigger className="w-36" aria-label="Payment method">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All methods</SelectItem>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex w-full items-center gap-1 sm:w-auto">
        <Input type="date" className="flex-1 sm:w-36 sm:flex-none" aria-label="From date" value={value.startDate} onChange={(e) => set("startDate", e.target.value)} />
        <span className="text-muted-foreground">–</span>
        <Input type="date" className="flex-1 sm:w-36 sm:flex-none" aria-label="To date" value={value.endDate} onChange={(e) => set("endDate", e.target.value)} />
      </div>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          <X /> Clear
        </Button>
      )}
    </div>
  );
}
