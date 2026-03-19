import { Link, useLocation } from "wouter";
import { LayoutDashboard, TrendingUp, CalendarDays, Dumbbell, UtensilsCrossed, ShoppingCart, ArrowLeft, Users } from "lucide-react";
import { useCoachClient } from "@/context/coach-client-context";

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
  const { activeClient, setActiveClient } = useCoachClient();

  const isActive = (href: string): boolean => {
    return location === href || location.startsWith(href + "/");
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#111111]/95 backdrop-blur-xl border-t border-border/40 flex z-50">
      {activeClient && (
        <button
          onClick={() => { setActiveClient(null); window.location.href = "/coach/clients"; }}
          className="flex-1 flex flex-col items-center py-3 gap-1 transition-colors min-w-0 text-blue-400"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-wide truncate px-1">Clients</span>
        </button>
      )}
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
