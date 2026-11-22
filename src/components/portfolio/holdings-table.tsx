"use client";

import { AlertTriangle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatNumber, formatPercent, formatSignedMoney } from "@/lib/format";
import type { EnrichedHolding } from "@/lib/types";
import { cn } from "@/lib/utils";

const tone = (v: number | null) =>
  v === null ? "text-muted-foreground" : v > 0 ? "text-emerald-600" : v < 0 ? "text-red-600" : "text-muted-foreground";

export function HoldingsTable({
  holdings,
  baseCurrency,
  onEdit,
  onDelete,
}: {
  holdings: EnrichedHolding[];
  baseCurrency: string;
  onEdit: (h: EnrichedHolding) => void;
  onDelete: (h: EnrichedHolding) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Holding</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Shares</TableHead>
          <TableHead className="hidden text-right md:table-cell">Price</TableHead>
          <TableHead className="text-right">Value ({baseCurrency})</TableHead>
          <TableHead className="text-right">Day</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Unrealized P&amp;L</TableHead>
          <TableHead className="hidden text-right md:table-cell">Alloc.</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.map((h) => (
          <TableRow key={h.id}>
            <TableCell>
              <p className="flex items-center gap-1.5 font-medium">
                {h.ticker}
                {h.closePrice === null && <AlertTriangle className="size-3.5 text-amber-500" aria-label="No price yet" />}
              </p>
              <p className="max-w-48 truncate text-xs text-muted-foreground">
                {h.name}
                {h.exchange ? ` · ${h.exchange}` : ""}
              </p>
            </TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatNumber(h.shares)}</TableCell>
            <TableCell className="hidden text-right tabular-nums md:table-cell">
              {formatMoney(h.closePrice, h.currency)}
              {h.priceDate && <p className="text-xs text-muted-foreground">{h.priceDate}</p>}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatMoney(h.baseMarketValue, baseCurrency)}
              {h.currency !== baseCurrency && h.nativeMarketValue !== null && (
                <p className="text-xs font-normal text-muted-foreground">{formatMoney(h.nativeMarketValue, h.currency)}</p>
              )}
            </TableCell>
            <TableCell className={cn("text-right tabular-nums", tone(h.dayChangeBase ?? h.dayChangeNative))}>
              {formatPercent(h.dayChangePercent, 2, true)}
              <p className="text-xs">{formatSignedMoney(h.dayChangeBase, baseCurrency)}</p>
            </TableCell>
            <TableCell className={cn("hidden text-right tabular-nums lg:table-cell", tone(h.unrealizedPnlBase))}>
              {h.unrealizedPnlBase === null ? (
                <span className="text-xs">{h.avgCostPerShare === null ? "No cost basis" : "—"}</span>
              ) : (
                <>
                  {formatSignedMoney(h.unrealizedPnlBase, baseCurrency)}
                  <p className="text-xs">{formatPercent(h.unrealizedPnlPercent, 1, true)}</p>
                </>
              )}
            </TableCell>
            <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
              {formatPercent(h.allocationPercent, 1)}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${h.ticker}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onEdit(h)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(h)}>
                    <Trash2 /> Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
