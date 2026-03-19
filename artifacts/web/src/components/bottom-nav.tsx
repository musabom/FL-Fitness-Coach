import { Link, useLocation } from "wouter";
import { LayoutDashboard, TrendingUp, CalendarDays, Dumbbell, UtensilsCrossed, ShoppingCart } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/nutrition/meal-plan", icon: CalendarDays, label: "Meals" },
  { href: "/training/plan", icon: Dumbbell, label: "Workouts" },
  { href: "/progress", icon: TrendingUp, label: "Progress" },
  { href: "/nutrition/meals", icon: UtensilsCrossed, label: "Builder" },
  { href: "/training/builder", icon: Dumbbell, label: "Exercise" },
  { href: "/nutrition/shopping-list", icon: ShoppingCart, label: "Shop" },
];

export default function BottomNav() {
  const [location] = useLocation();

  const isActive = (href: string): boolean => {
    // Exact match or starts with href + /
    return location === href || location.startsWith(href + "/");
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#111111]/95 backdrop-blur-xl border-t border-border/40 flex z-50">
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors min-w-0 ${
            isActive(href) ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-wide truncate px-1">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
