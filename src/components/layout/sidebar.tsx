"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-5 md:flex">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2 text-base font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Wallet className="size-4" />
        </span>
        Finance
      </Link>
      <nav className="grid gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-3 text-xs text-muted-foreground">
        Press <kbd className="rounded border bg-background px-1 font-mono">Ctrl</kbd>+
        <kbd className="rounded border bg-background px-1 font-mono">K</kbd> to quick-add
      </p>
    </aside>
  );
}
