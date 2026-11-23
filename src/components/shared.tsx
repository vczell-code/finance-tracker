"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { shiftYearMonth } from "@/lib/dates";
import { formatCents, formatYearMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent className="grid gap-1">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          {label}
          {icon}
        </div>
        <div
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            tone === "positive" && "text-emerald-600 dark:text-emerald-400",
            tone === "negative" && "text-red-600 dark:text-red-400",
          )}
        >
          {value}
        </div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function MonthPicker({ value, onChange, max }: { value: string; onChange: (ym: string) => void; max?: string }) {
  const atMax = max !== undefined && value >= max;
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5">
      <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => onChange(shiftYearMonth(value, -1))}>
        <ChevronLeft />
      </Button>
      <span className="min-w-24 text-center text-sm font-medium tabular-nums">{formatYearMonth(value, true)}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next month"
        disabled={atMax}
        onClick={() => onChange(shiftYearMonth(value, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

/** Signed money amount: income green with "+", expense default with "−", transfer muted. */
export function TxAmount({
  cents,
  currency,
  type,
  className,
}: {
  cents: number;
  currency: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-medium whitespace-nowrap tabular-nums",
        type === "INCOME" && "text-emerald-600 dark:text-emerald-400",
        type === "TRANSFER" && "text-muted-foreground",
        className,
      )}
    >
      {type === "INCOME" ? "+" : type === "EXPENSE" ? "−" : ""}
      {formatCents(cents, currency)}
    </span>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-background px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{message}</p>;
}
