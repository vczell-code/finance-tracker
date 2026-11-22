"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const QuickAddContext = createContext<{ open: () => void }>({ open: () => {} });

export const useQuickAdd = () => useContext(QuickAddContext);

/** Global Quick-Add modal, opened with Cmd/Ctrl+K or the header button. */
export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (!o) setFormKey((k) => k + 1);
          return !o;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openDialog = () => {
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  return (
    <QuickAddContext.Provider value={{ open: openDialog }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add transaction</DialogTitle>
            <DialogDescription>Amount → merchant → category → save. Defaults to today.</DialogDescription>
          </DialogHeader>
          <TransactionForm key={formKey} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </QuickAddContext.Provider>
  );
}

export function QuickAddButton() {
  const { open } = useQuickAdd();
  return (
    <Button onClick={open} size="sm">
      <Plus />
      <span className="hidden sm:inline">Add Transaction</span>
      <span className="sm:hidden">Add</span>
    </Button>
  );
}
