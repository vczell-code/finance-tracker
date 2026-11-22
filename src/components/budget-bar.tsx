"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** Budget utilisation bar: green < 80%, amber 80–99%, red ≥ 100% (status colour + text label elsewhere). */
export function BudgetBar({ percent, className }: { percent: number; className?: string }) {
  return (
    <Progress
      value={Math.min(percent, 100)}
      aria-label={`${Math.round(percent)}% of budget used`}
      className={cn(
        "h-2",
        percent >= 100
          ? "[&>[data-slot=progress-indicator]]:bg-red-500"
          : percent >= 80
            ? "[&>[data-slot=progress-indicator]]:bg-amber-500"
            : "[&>[data-slot=progress-indicator]]:bg-emerald-500",
        className,
      )}
    />
  );
}
