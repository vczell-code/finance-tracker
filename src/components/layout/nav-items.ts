import { CalendarClock, LayoutDashboard, LineChart, PiggyBank, Receipt, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/subscriptions", label: "Subscriptions", icon: CalendarClock },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/portfolio", label: "Portfolio", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
