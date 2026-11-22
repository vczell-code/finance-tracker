"use client";

import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LastUpdated({
  lastUpdated,
  refreshing,
  onRefresh,
}: {
  lastUpdated: string | null | undefined;
  refreshing: boolean;
  onRefresh?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>Last updated: {refreshing && !lastUpdated ? "updating…" : formatDateTime(lastUpdated)}</span>
      {onRefresh ? (
        <Button variant="ghost" size="icon-xs" onClick={onRefresh} disabled={refreshing} aria-label="Refresh prices">
          <RefreshCw className={cn(refreshing && "animate-spin")} />
        </Button>
      ) : (
        refreshing && <RefreshCw className="size-3 animate-spin" aria-label="Refreshing" />
      )}
    </span>
  );
}

export function RefreshWarning({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss" className="rounded p-0.5 hover:bg-amber-100">
        <X className="size-4" />
      </button>
    </div>
  );
}
