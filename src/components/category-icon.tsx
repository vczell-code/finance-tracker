import {
  ArrowLeftRight,
  Briefcase,
  Bus,
  CircleEllipsis,
  Cloud,
  Coffee,
  Dumbbell,
  Gamepad2,
  Gift,
  HeartPulse,
  Home,
  Landmark,
  Plane,
  Shield,
  Shirt,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingUp,
  Tv,
  Utensils,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  home: Home,
  zap: Zap,
  wifi: Wifi,
  tv: Tv,
  cloud: Cloud,
  dumbbell: Dumbbell,
  shield: Shield,
  landmark: Landmark,
  "shopping-cart": ShoppingCart,
  utensils: Utensils,
  coffee: Coffee,
  bus: Bus,
  plane: Plane,
  "heart-pulse": HeartPulse,
  shirt: Shirt,
  "gamepad-2": Gamepad2,
  "circle-ellipsis": CircleEllipsis,
  briefcase: Briefcase,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  gift: Gift,
  tag: Tag,
  transfer: ArrowLeftRight,
};

export function CategoryIcon({
  icon,
  color,
  className,
  size = "md",
}: {
  icon?: string | null;
  color?: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const Icon = (icon && CATEGORY_ICONS[icon]) || Tag;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        size === "sm" ? "size-6" : "size-8",
        className,
      )}
      style={{ backgroundColor: `${color ?? "#94a3b8"}1f`, color: color ?? "#64748b" }}
      aria-hidden
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}
