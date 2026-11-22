"use client";

import { MoreHorizontal, Pencil, Repeat, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { TxAmount } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_METHOD_LABELS, formatDate } from "@/lib/format";
import type { TransactionWithCategory } from "@/lib/types";

export function TransactionTable({
  items,
  onEdit,
  onDelete,
}: {
  items: TransactionWithCategory[];
  onEdit: (t: TransactionWithCategory) => void;
  onDelete: (t: TransactionWithCategory) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">Date</TableHead>
          <TableHead>Merchant</TableHead>
          <TableHead className="hidden md:table-cell">Category</TableHead>
          <TableHead className="hidden lg:table-cell">Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((t) => (
          <TableRow key={t.id} className="cursor-pointer" onClick={() => onEdit(t)}>
            <TableCell className="text-muted-foreground tabular-nums">{formatDate(t.date)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <CategoryIcon
                  icon={t.type === "TRANSFER" ? "transfer" : t.category?.icon}
                  color={t.category?.color}
                  size="sm"
                  className="md:hidden"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {t.merchant}
                    {t.recurringRuleId && <Repeat className="size-3 text-muted-foreground" aria-label="Recurring" />}
                  </p>
                  {t.notes && <p className="max-w-xs truncate text-xs text-muted-foreground">{t.notes}</p>}
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {t.type === "TRANSFER" ? (
                <Badge variant="outline">Transfer</Badge>
              ) : (
                <span className="flex items-center gap-2">
                  <CategoryIcon icon={t.category?.icon} color={t.category?.color} size="sm" />
                  {t.category?.name ?? "—"}
                </span>
              )}
            </TableCell>
            <TableCell className="hidden text-muted-foreground lg:table-cell">{PAYMENT_METHOD_LABELS[t.paymentMethod]}</TableCell>
            <TableCell className="text-right">
              <TxAmount cents={t.amountCents} currency={t.currency} type={t.type} />
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.merchant}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onEdit(t)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(t)}>
                    <Trash2 /> Delete
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
