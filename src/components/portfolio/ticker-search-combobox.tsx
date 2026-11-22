"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/client";
import type { TickerSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TickerSearchCombobox({
  value,
  onChange,
  id,
  invalid,
}: {
  value: TickerSearchResult | null;
  onChange: (v: TickerSearchResult | null) => void;
  id?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ results: TickerSearchResult[] }>(`/api/portfolio/search?q=${encodeURIComponent(q)}`);
        if (!cancelled) {
          setResults(res.results);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const manual = query.trim().toUpperCase();
  const shown = query.trim() ? results : [];
  const showManual = manual && !shown.some((r) => r.ticker === manual);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className="w-full justify-between font-normal"
        >
          {value ? (
            <span className="truncate">
              <span className="font-medium">{value.ticker}</span>
              <span className="text-muted-foreground"> · {value.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Search by name or ticker…</span>
          )}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="e.g. Apple, VWCE, MSFT" value={query} onValueChange={setQuery} />
          <CommandList>
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Searching…
              </div>
            )}
            {error && <p className="px-3 py-2 text-xs text-destructive">{error}</p>}
            {!loading && query.trim() && <CommandEmpty>No matches found.</CommandEmpty>}
            {shown.length > 0 && (
              <CommandGroup heading="Results">
                {shown.map((r) => (
                  <CommandItem
                    key={r.ticker}
                    value={r.ticker}
                    onSelect={() => {
                      onChange(r);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value?.ticker === r.ticker ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-medium">{r.ticker}</span> <span className="text-muted-foreground">{r.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[r.typeDisp, r.exchange].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showManual && !loading && (
              <CommandGroup heading="Manual">
                <CommandItem
                  value={`manual-${manual}`}
                  onSelect={() => {
                    onChange({ ticker: manual, name: manual, exchange: null, typeDisp: null });
                    setOpen(false);
                  }}
                >
                  Use ticker “{manual}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
