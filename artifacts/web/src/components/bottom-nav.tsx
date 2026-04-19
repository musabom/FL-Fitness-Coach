import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, TrendingUp, CalendarDays, Dumbbell,
  UtensilsCrossed, ShoppingCart, ArrowLeft,
} from "lucide-react";
import { useCoachClient } from "@/context/coach-client-context";
import { useLanguage } from "@/context/language-context";

export default function BottomNav() {
  const [location] = useLocation();
  const { activeClient, setActiveClient } = useCoachClient();
  const { t } = useLanguage();

  const NAV_ITEMS = [
    { href: "/dashboard",              icon: LayoutDashboard,  label: t("nav.dashboard") },
    { href: "/nutrition/meal-plan",    icon: CalendarDays,     label: t("nav.meals") },
    { href: "/training/plan",          icon: Dumbbell,         label: t("nav.workouts") },
    { href: "/progress",               icon: TrendingUp,       label: t("nav.progress") },
    { href: "/nutrition/meals",        icon: UtensilsCrossed,  label: t("nav.builder") },
    { href: "/training/builder",       icon: Dumbbell,         label: t("nav.exercise") },
    { href: "/nutrition/shopping-list",icon: ShoppingCart,     label: t("nav.shop") },
  ];

  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  const handleBackToManagement = () => {
    const backPath = activeClient?.mode === "admin" ? "/admin" : "/coach/clients";
    setActiveClient(null);
    window.location.href = backPath;
  };

  return (
    /* FLBottomNav: rgba(17,17,17,0.95) bg, 18px backdrop-blur, top hairline */
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50
                    flex bg-[rgba(17,17,17,0.95)] backdrop-blur-[18px]
                    border-t border-[rgba(27,50,96,0.5)]">

      {/* Back-to-management button (coach / admin impersonation) */}
      {activeClient && (
        <button
          onClick={handleBackToManagement}
          className="flex-1 flex flex-col items-center py-2.5 pb-3 gap-1
                     text-info transition-colors duration-150 min-w-0"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          <span className="text-[10px] font-medium tracking-wide truncate px-1">
            {activeClient.mode === "admin" ? t("nav.admin") : t("nav.clients")}
          </span>
        </button>
      )}

      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-2.5 pb-3 gap-1 min-w-0
                        transition-colors duration-150
                        ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-5 h-5" strokeWidth={2} />
            <span className="text-[10px] font-medium tracking-wide truncate px-1">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
