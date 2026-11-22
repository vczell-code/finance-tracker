"use client";

import { CategoryIcon } from "@/components/category-icon";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/lib/types";

/** Category picker grouped by groupName. `value` is the category id as a string ("" = none). */
export function CategorySelect({
  id,
  categories,
  value,
  onChange,
  placeholder = "Select category",
  allowAll,
  className,
  invalid,
}: {
  id?: string;
  categories: Category[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  allowAll?: string;
  className?: string;
  invalid?: boolean;
}) {
  const groups = new Map<string, Category[]>();
  for (const c of categories) {
    const key = `${c.type === "INCOME" ? "Income" : "Expense"} · ${c.groupName}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return (
    <Select value={value || (allowAll ? "all" : "")} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
      <SelectTrigger id={id} className={className ?? "w-full"} aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="all">{allowAll}</SelectItem>}
        {[...groups.entries()].map(([group, cats]) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {cats.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
