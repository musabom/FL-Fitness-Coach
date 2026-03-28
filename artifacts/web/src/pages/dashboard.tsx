import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { usePlan } from "@/hooks/use-plan";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import {
  Settings, LogOut, Loader2, ChevronRight, ChevronDown,
  UtensilsCrossed, CalendarDays, ShoppingCart, Dumbbell, ClipboardList, Flame, Zap, Edit2, Check, X,
  ArrowLeft, UserCheck, Bell, Search, AlertTriangle, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { customFetch, getGetActivePlanQueryKey } from "@workspace/api-client-react";
import BottomNav from "@/components/bottom-nav";
import { useCoachClient, useClientUrl } from "@/context/coach-client-context";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function getMondayStr() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

interface TodayData {
  nutrition: {
    consumed: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
    planned: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  };
  training: { planned_calories: number; burned_calories: number };
  tdee: number;
  totalBurned: number;
  balance: number;
}

interface WeeklyDay {
  date: string; day: string;
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
  burned_calories: number;
}

interface WeeklyData {
  week_start: string; week_end: string;
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number; burned_calories: number };
  days: WeeklyDay[];
  tdee: number;
  totalBurned: number;
  balance: number;
}

function CompactMacroBar({ label, consumed, planned, color, unit }: { label: string; consumed: number; planned: number; color: string; unit: string }) {
  const pct = planned > 0 ? Math.min(100, (consumed / planned) * 100) : 0;
  const net = consumed - planned;
  const netColor = net > 0 ? color : "text-muted-foreground";
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-foreground">
          {Math.round(consumed)}<span className="text-xs text-muted-foreground ml-0.5">/</span>{Math.round(planned)}<span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
        </span>
        <span className={`text-xs font-semibold ${netColor}`}>
          {net >= 0 ? '+' : ''}{Math.round(net)}{unit}
        </span>
      </div>
      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-xs text-muted-foreground text-right">{label}</div>
    </div>
  );
}

function CalBar({ label, value, target, color, unit = "kcal" }: { label: string; value: number; target: number; color: string; unit?: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-xs text-foreground/70">
          <span className="font-semibold text-foreground">{Math.round(value)}</span>
          <span className="text-muted-foreground"> / {Math.round(target)} {unit}</span>
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function MiniStatPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="flex-1 bg-[#1A1A1A] rounded-2xl p-3 flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-lg font-bold" style={{ color }}>{Math.round(value)}</span>
      <span className="text-[10px] text-muted-foreground">{unit}</span>
    </div>
  );
}

export default function Dashboard() {
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [collapsedNutrition, setCollapsedNutrition] = useState(false);
  const [collapsedTraining, setCollapsedTraining] = useState(false);
  const [collapsedWeight, setCollapsedWeight] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);
  const [editWeight, setEditWeight] = useState<string>("");
  const { plan, isLoading: planLoading } = usePlan();
  const { user, logout } = useAuth();
  const { activeClient, setActiveClient } = useCoachClient();
  const { t, lang } = useLanguage();
  const buildUrl = useClientUrl();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = todayStr();
  const viewMode = activeClient?.mode ?? null;
  const isCoachView = !!activeClient;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const cancelSubscription = useMutation({
    mutationFn: () => customFetch("/api/subscription/cancel", { method: "POST" }),
    onSuccess: () => {
      setShowCancelConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      toast({ title: "Subscription cancelled", description: "You'll keep full access until the end of your current period." });
    },
    onError: () => toast({ title: "Failed to cancel", variant: "destructive" }),
  });

  const reactivateSubscription = useMutation({
    mutationFn: () => customFetch("/api/subscription/reactivate", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      toast({ title: "Subscription reactivated!", description: "Your subscription is now active again." });
    },
    onError: () => toast({ title: "Failed to reactivate", variant: "destructive" }),
  });


  const { data: todayData, refetch: refetchToday } = useQuery<TodayData>({
    queryKey: ["dashboard-today", today, activeClient?.id],
    queryFn: () => customFetch<TodayData>(buildUrl(`${BASE}/dashboard/today?date=${today}`)),
    enabled: !!plan,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 5000,
  });

  const mondayStr = getMondayStr();
  const { data: weeklyData } = useQuery<WeeklyData>({
    queryKey: ["dashboard-weekly", mondayStr, activeClient?.id],
    queryFn: () => customFetch<WeeklyData>(buildUrl(`${BASE}/dashboard/weekly?week_start=${mondayStr}`)),
    enabled: view === "weekly" && !!plan,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 5000,
  });

  const consumed = todayData?.nutrition.consumed ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const planned = todayData?.nutrition.planned ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const training = todayData?.training ?? { planned_calories: 0, burned_calories: 0 };

  const weeklyMaxCal = useMemo(
    () => Math.max(...(weeklyData?.days.map(d => Math.max(d.calories, d.burned_calories)) ?? [1])),
    [weeklyData]
  );

  if (planLoading) {
    return (
      <div className="mobile-container flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const handleBackToManagement = () => {
    const backPath = viewMode === "admin" ? "/admin" : "/coach/clients";
    setActiveClient(null);
    setLocation(backPath);
  };

  if (!plan) {
    return (
      <div className="mobile-container flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-bold mb-2">{t("dashboard.noActivePlan")}</h2>
        <p className="text-muted-foreground mb-6">
          {isCoachView 
            ? t("dashboard.noActivePlanCoach")
            : t("dashboard.noActivePlanMember")}
        </p>
        <div className="w-full space-y-3">
          {isCoachView && (
            <Button 
              variant="outline"
              className="w-full"
              onClick={handleBackToManagement}
            >
              <ArrowLeft className="w-4 h-4 me-2" /> {t("common.back")}
            </Button>
          )}
          {!isCoachView && (
            <Link href="/onboarding" className="w-full">
              <Button className="w-full">{t("dashboard.startOnboarding")}</Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const goalLabels: Record<string, string> = {
    recomposition: t("dashboard.goalLabels.recomposition"),
    cut: t("dashboard.goalLabels.cut"),
    lean_bulk: t("dashboard.goalLabels.lean_bulk"),
    maintenance: t("dashboard.goalLabels.maintenance"),
    custom: t("dashboard.goalLabels.custom"),
  };

  const weightGapStr = plan.weightKg > plan.targetWeightKg
    ? `${t("dashboard.weightGapLose")} ${(plan.weightKg - plan.targetWeightKg).toFixed(1)} ${t("common.kg")}`
    : plan.weightKg < plan.targetWeightKg
      ? `${t("dashboard.weightGapGain")} ${(plan.targetWeightKg - plan.weightKg).toFixed(1)} ${t("common.kg")}`
      : t("dashboard.weightGapAtTarget");

  return (
    <div className="mobile-container overflow-y-auto scrollbar-none pb-24">
      {/* Coach/Admin viewing-client banner */}
      {isCoachView && (
        <div className="sticky top-0 z-20 bg-blue-600/90 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">{t("dashboard.viewing")} {activeClient.name}</span>
          </div>
          <button
            onClick={handleBackToManagement}
            className="flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t("common.back")}
          </button>
        </div>
      )}

      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center sticky top-0 bg-background/80 backdrop-blur-xl z-10 border-b border-border/50" style={{ top: isCoachView ? "44px" : "0" }}>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{new Date().toLocaleDateString(lang === "ar" ? 'ar-SA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="icon-only" />
          {isCoachView && (
            <button
              onClick={handleBackToManagement}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
              title={viewMode === "admin" ? "Back to Admin Panel" : "Back to My Clients"}
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
          )}
          {!isCoachView && user?.role === "coach" && (
            <button
              onClick={handleBackToManagement}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
              title="Back to My Clients"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
          )}
          {(isCoachView || user?.role === "member") && (
            <Link href="/profile/edit" className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
              <Settings className="w-5 h-5 text-foreground" />
            </Link>
          )}
          {!isCoachView && user?.role === "member" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/coaches")}
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground border border-border/50"
            >
              <Search className="w-3.5 h-3.5" />
              {t("dashboard.browse")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout.mutate()}
            className="text-xs gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t("common.signOut")}
          </Button>
        </div>
      </header>
      <main className="px-6 pt-6 space-y-6">
        {/* Member: coach assigned banner */}
        {!isCoachView && user?.coachName && (
          <div className="space-y-2">
            {/* Cancelling warning banner */}
            {(user as any).subscriptionStatus === "cancelling" && (
              <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-yellow-500">Cancellation Scheduled</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your coach will continue serving you for {user.subscriptionDaysLeft ?? "—"} more day{user.subscriptionDaysLeft === 1 ? "" : "s"}.
                  </p>
                </div>
                <button
                  onClick={() => reactivateSubscription.mutate()}
                  disabled={reactivateSubscription.isPending}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline flex-shrink-0"
                >
                  {reactivateSubscription.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Reactivate
                </button>
              </div>
            )}

            {/* Coach info card */}
            <div className={`rounded-2xl px-4 py-3 border ${(user as any).subscriptionStatus === "cancelling" ? "bg-muted/30 border-border" : "bg-primary/10 border-primary/20"}`}>
              <div className="flex items-center gap-3">
                <UserCheck className={`w-4 h-4 flex-shrink-0 ${(user as any).subscriptionStatus === "cancelling" ? "text-muted-foreground" : "text-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${(user as any).subscriptionStatus === "cancelling" ? "text-muted-foreground" : "text-primary"}`}>{t("dashboard.yourCoach")}</p>
                  <p className="text-sm text-foreground">{user.coachName}</p>
                  {user.subscriptionDaysLeft !== null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("dashboard.subscriptionCyclePrefix")} {user.subscriptionDaysLeft} {t("dashboard.subscriptionCycleSuffix")}
                    </p>
                  )}
                </div>
                {user.subscriptionDaysLeft !== null && (
                  <div className="flex-shrink-0 text-center">
                    <p className={`text-lg font-bold ${user.subscriptionDaysLeft <= 5 ? "text-destructive" : (user as any).subscriptionStatus === "cancelling" ? "text-muted-foreground" : "text-primary"}`}>
                      {user.subscriptionDaysLeft}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{t("dashboard.daysLeft")}</p>
                  </div>
                )}
              </div>

              {/* Cancel / confirm buttons */}
              {(user as any).subscriptionStatus !== "cancelling" && (
                <div className="mt-3 pt-3 border-t border-border/30">
                  {showCancelConfirm ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Your coach is obligated to serve you until the end of this period. Are you sure?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => cancelSubscription.mutate()}
                          disabled={cancelSubscription.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-xl py-2 transition-colors"
                        >
                          {cancelSubscription.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          Yes, cancel subscription
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(false)}
                          className="flex-1 text-xs font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-xl py-2 transition-colors"
                        >
                          Keep subscription
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Cancel subscription
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Member: coach updated plan banner */}
        {!isCoachView && user?.coachUpdatedAt && (
          <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-3">
            <Bell className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-yellow-500">{t("dashboard.planUpdated")}</p>
              <p className="text-sm text-foreground">{t("dashboard.planUpdatedMsg")}</p>
            </div>
          </div>
        )}
        {/* Member: no coach yet — Find a Coach CTA */}
        {!isCoachView && user?.role === "member" && !user?.coachId && (
          <button
            onClick={() => setLocation("/coaches")}
            className="w-full flex items-center justify-between gap-3 bg-card border border-border hover:border-primary/40 rounded-2xl px-4 py-4 transition-colors text-start group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Search className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("dashboard.findCoach")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboard.findCoachHint")}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </button>
        )}

        {/* Toggle */}
        <div className="flex gap-1 p-1 bg-[#1A1A1A] rounded-2xl">
          <button
            onClick={() => setView("daily")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${view === "daily" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t("dashboard.daily")}
          </button>
          <button
            onClick={() => setView("weekly")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${view === "weekly" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t("dashboard.weekly")}
          </button>
        </div>

        {/* ─── DAILY VIEW ─── */}
        {view === "daily" && (
          <>
            {/* AM I ON TRACK? Card */}
            <section className="py-4">
              <Card className="p-5 bg-[#1A1A1A] border-none">
                <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-4">{t("dashboard.onTrack")}</h3>

                {/* Column headers */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"></div>
                  <div className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dashboard.consumed")}</div>
                  <div className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dashboard.target")}</div>
                  <div className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dashboard.variance")}</div>
                </div>

                {/* Table */}
                <div className="space-y-1">
                  {/* Row 1: Calories */}
                  <div className="grid grid-cols-4 gap-2 py-2.5 border-b border-white/5">
                    <div className="flex items-center">
                      <span className="text-xs font-semibold text-muted-foreground">{t("dashboard.calories")}</span>
                    </div>
                    <div className="text-center text-sm">
                      <div className="font-bold text-foreground">{Math.round(consumed.calories)}<span className="text-[10px] text-muted-foreground ml-0.5">kcal</span></div>
                    </div>
                    <div className="text-center text-sm">
                      <div className="font-bold text-foreground">{Math.round(plan.calorieTarget)}<span className="text-[10px] text-muted-foreground ml-0.5">kcal</span></div>
                    </div>
                    <div className={`text-center text-sm font-bold ${
                      (() => {
                        const variance = consumed.calories - plan.calorieTarget;
                        return variance >= 0 ? "text-green-500" : "text-red-500";
                      })()
                    }`}>
                      {(() => {
                        const variance = consumed.calories - plan.calorieTarget;
                        return `${variance >= 0 ? "+" : "−"}${Math.abs(Math.round(variance))}`;
                      })()}
                    </div>
                  </div>

                  {/* Row 2: Protein */}
                  <div className="grid grid-cols-4 gap-2 py-2.5 border-b border-white/5">
                    <div className="flex items-center">
                      <span className="text-xs font-semibold text-muted-foreground">{t("dashboard.protein")}</span>
                    </div>
                    <div className="text-center text-sm">
                      <div className="font-bold text-foreground">{Math.round(consumed.protein_g)}<span className="text-[10px] text-muted-foreground ml-0.5">g</span></div>
                    </div>
                    <div className="text-center text-sm">
                      <div className="font-bold text-foreground">{Math.round(planned.protein_g || plan.proteinG)}<span className="text-[10px] text-muted-foreground ml-0.5">g</span></div>
                    </div>
                    <div className={`text-center text-sm font-bold ${
                      (() => {
                        const variance = consumed.protein_g - (planned.protein_g || plan.proteinG);
                        return variance >= 0 ? "text-green-500" : "text-red-500";
                      })()
                    }`}>
                      {(() => {
                        const variance = consumed.protein_g - (planned.protein_g || plan.proteinG);
                        return `${variance >= 0 ? "+" : "−"}${Math.abs(Math.round(variance))}g`;
                      })()}
                    </div>
                  </div>

                  {/* Row 3: Carbs */}
                  <div className="grid grid-cols-4 gap-2 py-2.5 border-b border-white/5">
                    <div className="flex items-center">
                      <span className="text-xs font-semibold text-muted-foreground">{t("dashboard.carbs")}</span>
                    </div>
                    <div className="text-center text-sm">
                      <div className="font-bold text-foreground">{Math.round(consumed.carbs_g)}<span className="text-[10px] text-muted-foreground ml-0.5">g</span></div>
                    </div>
                    <div className="text-center text-sm">
                      <div className="font-bold text-foreground">{Math.round(planned.carbs_g || plan.carbsG)}<span className="text-[10px] text-muted-foreground ml-0.5">g</span></div>
                    </div>
                    <div className={`text-center text-sm font-bold ${
                      (() => {
                        const variance = consumed.carbs_g - (planned.carbs_g || plan.carbsG);
                        return variance >= 0 ? "text-green-500" : "text-red-500";
                      })()
                    }`}>
                      {(() => {
                        const variance = consumed.carbs_g - (planned.carbs_g || plan.carbsG);
                        return `${variance >= 0 ? "+" : "−"}${Math.abs(Math.round(variance))}g`;
                      })()}
                    </div>
                  </div>

                  {/* Row 4: Fat */}
                  <div className="grid grid-cols-4 gap-2 py-2.5">
                    <div className="flex items-center">
                      <span className="text-xs font-semibold text-muted-foreground">{t("dashboard.fats")}</span>
                    </div>
                    <div className="text-center text-sm">
                      <div className="font-bold text-foreground">{Math.round(consumed.fat_g)}<span className="text-[10px] text-muted-foreground ml-0.5">g</span></div>
                    </div>
                    <div className="text-center text-sm">
                      <div className="font-bold text-foreground">{Math.round(planned.fat_g || plan.fatG)}<span className="text-[10px] text-muted-foreground ml-0.5">g</span></div>
                    </div>
                    <div className={`text-center text-sm font-bold ${
                      (() => {
                        const variance = consumed.fat_g - (planned.fat_g || plan.fatG);
                        return variance >= 0 ? "text-green-500" : "text-red-500";
                      })()
                    }`}>
                      {(() => {
                        const variance = consumed.fat_g - (planned.fat_g || plan.fatG);
                        return `${variance >= 0 ? "+" : "−"}${Math.abs(Math.round(variance))}g`;
                      })()}
                    </div>
                  </div>
                </div>

                {/* TODAY'S DEFICIT */}
                <div className="mt-6 pt-4 border-t border-white/5 space-y-2.5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("dashboard.dailyDeficit")}</h4>
                  
                  {/* Maintenance (TDEE) */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{t("dashboard.maintenance")}</span>
                    <span className="font-bold text-foreground">{Math.round(plan.tdeeEstimated ?? 0)} {t("common.kcal")}</span>
                  </div>

                  {/* Consumed */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{t("dashboard.consumed")}</span>
                    <span className="font-bold text-foreground">{Math.round(consumed.calories ?? 0)} {t("common.kcal")}</span>
                  </div>

                  {/* Training Burn */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{t("dashboard.trainingBurn")}</span>
                    <span className="font-bold text-foreground">{Math.round(training.burned_calories ?? 0)} {t("common.kcal")}</span>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-white/10 my-2" />

                  {/* Total Deficit */}
                  {(() => {
                    const tdee = plan.tdeeEstimated ?? 0;
                    const consumedCals = consumed.calories ?? 0;
                    const burned = training.burned_calories ?? 0;
                    const dailyDeficit = consumedCals - burned - tdee;
                    
                    let color = "text-primary"; // teal if negative (deficit)
                    if (dailyDeficit > -200 && dailyDeficit < 0) color = "text-amber-500"; // amber if -200 to 0
                    if (dailyDeficit >= 0) color = "text-red-500"; // red if positive (surplus)
                    
                    return (
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-foreground">{t("dashboard.total")}</span>
                        <span className={`text-lg font-bold ${color}`}>
                          {dailyDeficit >= 0 ? "+" : ""}{Math.round(dailyDeficit)} kcal
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </Card>
            </section>

            {/* Daily Target — Hidden */}
            {false && (
            <section className="py-4 flex flex-col items-center">
              <div className="text-xs font-semibold tracking-widest text-primary uppercase mb-2">{t("dashboard.dailyTarget")}</div>
              <div className="text-5xl font-light tracking-tighter text-primary">{plan.calorieTarget}</div>
              <div className="text-xs text-muted-foreground mt-1">kcal</div>
              <div className="flex justify-center mt-4">
                <div className={`px-4 py-1.5 rounded-full text-sm font-medium ${plan.goalMode === "custom" ? "bg-teal-500/15 border border-teal-500/30 text-teal-400" : "bg-primary/10 border border-primary/20 text-primary"}`}>
                  {goalLabels[plan.goalMode] || plan.goalMode}
                </div>
              </div>
            </section>
            )}

            {/* Calorie Balance — Hidden */}
            {false && (
            <section className="space-y-3">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Calorie Balance</p>
              <Card className="p-5 bg-[#1A1A1A] border-none space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Consumed</span>
                    <span className="text-2xl font-bold text-foreground">{Math.round(todayData?.nutrition.consumed.calories ?? 0)}</span>
                    <span className="text-xs text-muted-foreground">kcal</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Burned</span>
                    <span className="text-2xl font-bold text-orange-400">{Math.round(todayData?.totalBurned ?? 0)}</span>
                    <span className="text-xs text-muted-foreground">kcal</span>
                    <div className="text-[10px] text-muted-foreground mt-1 text-center">
                      <div>{Math.round(todayData?.tdeeEstimated ?? 0)} kcal baseline</div>
                      {(todayData?.workoutBurned ?? 0) > 0 && <div>+{Math.round(todayData?.workoutBurned ?? 0)} kcal exercise</div>}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Net</span>
                    <span className={`text-2xl font-bold ${(todayData?.balance ?? 0) < 0 ? "text-primary" : "text-amber-500"}`}>
                      {(todayData?.balance ?? 0) < 0 ? "−" : "+"}{Math.abs(Math.round(todayData?.balance ?? 0))}
                    </span>
                    <span className="text-xs text-muted-foreground">{(todayData?.balance ?? 0) < 0 ? "deficit" : "surplus"}</span>
                  </div>
                </div>
              </Card>
            </section>
            )}

            {/* Daily Nutrition Progress — Hidden */}
            {false && (
            <section className="space-y-3">
              <button
                onClick={() => setCollapsedNutrition(!collapsedNutrition)}
                className="w-full flex items-center justify-between p-0"
              >
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Today's Nutrition</p>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsedNutrition ? "rotate-180" : ""}`} />
              </button>
              {!collapsedNutrition && (
                <Card className="p-5 bg-[#1A1A1A] border-none space-y-6">
                  {/* Calories */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-primary">
                        {Math.round(consumed.calories)}<span className="text-sm text-muted-foreground mx-0.5">/</span>{Math.round(plan.calorieTarget)}<span className="text-sm text-muted-foreground ml-1">kcal</span>
                      </span>
                      <span className={`text-sm font-semibold ${consumed.calories - plan.calorieTarget > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {consumed.calories - plan.calorieTarget >= 0 ? '+' : ''}{Math.round(consumed.calories - plan.calorieTarget)} kcal
                      </span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (consumed.calories / plan.calorieTarget) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Protein */}
                  <CompactMacroBar label="Protein" consumed={consumed.protein_g} planned={planned.protein_g || plan.proteinG} color="#3B82F6" unit="g" />

                  {/* Carbs */}
                  <CompactMacroBar label="Carbs" consumed={consumed.carbs_g} planned={planned.carbs_g || plan.carbsG} color="#F59E0B" unit="g" />

                  {/* Fat */}
                  <CompactMacroBar label="Fat" consumed={consumed.fat_g} planned={planned.fat_g || plan.fatG} color="#EAB308" unit="g" />
                </Card>
              )}
            </section>
            )}

            {/* Daily Workout Burn */}
            <section className="space-y-3">
              <button
                onClick={() => setCollapsedTraining(!collapsedTraining)}
                className="w-full flex items-center justify-between p-0"
              >
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("workoutPlan.title")}</p>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsedTraining ? "rotate-180" : ""}`} />
              </button>
              {!collapsedTraining && (
                <Card className="p-5 bg-[#1A1A1A] border-none space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <Zap className="w-4 h-4 text-muted-foreground mb-0.5" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("dashboard.planned")}</span>
                      <span className="text-2xl font-bold text-foreground">{Math.round(training.planned_calories)}</span>
                      <span className="text-xs text-muted-foreground">{t("common.kcal")}</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <Flame className="w-4 h-4 text-orange-400 mb-0.5" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("dashboard.burned")}</span>
                      <span className="text-2xl font-bold text-orange-400">{Math.round(training.burned_calories)}</span>
                      <span className="text-xs text-muted-foreground">{t("common.kcal")}</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider mt-5">{t("dashboard.remaining")}</span>
                      <span className={`text-2xl font-bold ${training.planned_calories - training.burned_calories > 0 ? "text-primary" : "text-red-400"}`}>
                        {Math.round(Math.max(0, training.planned_calories - training.burned_calories))}
                      </span>
                      <span className="text-xs text-muted-foreground">kcal</span>
                    </div>
                  </div>

                  {training.planned_calories > 0 && (
                    <CalBar
                      label="Burn Progress"
                      value={training.burned_calories}
                      target={training.planned_calories}
                      color="#F97316"
                    />
                  )}
                </Card>
              )}
            </section>

            {/* Weight & Timeline */}
            <section className="space-y-3">
              <button
                onClick={() => setCollapsedWeight(!collapsedWeight)}
                className="w-full flex items-center justify-between p-0"
              >
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("dashboard.weight")}</p>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsedWeight ? "rotate-180" : ""}`} />
              </button>
              {!collapsedWeight && (
                <Card className="p-5 bg-[#1A1A1A] border-none space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("dashboard.started")}</span>
                      <span className="text-2xl font-bold text-foreground">{Math.round((plan.startedWeightKg ?? plan.weightKg) * 10) / 10}</span>
                      <span className="text-xs text-muted-foreground">{t("common.kg")}</span>
                      <p className="text-[10px] text-muted-foreground mt-1">{t("dashboard.readOnly")}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("dashboard.current")}</span>
                      {!editingWeight ? (
                        <>
                          <span className="text-2xl font-bold text-foreground">{plan.weightKg}</span>
                          <span className="text-xs text-muted-foreground">kg</span>
                          <button
                            onClick={() => {
                              setEditingWeight(true);
                              setEditWeight(String(plan.weightKg));
                            }}
                            className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 mt-1"
                          >
                            <Edit2 className="w-3 h-3" /> {t("common.edit")}
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col gap-2 w-full">
                          <input
                            type="number"
                            step="0.1"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary text-center"
                            placeholder="kg"
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={async () => {
                                try {
                                  await customFetch(`${BASE}/profile`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ weightKg: parseFloat(editWeight) }),
                                  });
                                  setEditingWeight(false);
                                  setEditWeight("");
                                  // Invalidate plan to trigger refetch with new weight and recalculated metabolic rate
                                  await queryClient.invalidateQueries({ 
                                    queryKey: getGetActivePlanQueryKey() 
                                  });
                                  // Also refetch today's data to update calorie targets
                                  refetchToday();
                                } catch (error) {
                                  console.error("Failed to update weight:", error);
                                }
                              }}
                              className="flex-1 p-1 bg-primary hover:bg-primary/90 rounded text-primary-foreground transition text-xs"
                            >
                              <Check className="w-3 h-3 mx-auto" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingWeight(false);
                                setEditWeight("");
                              }}
                              className="flex-1 p-1 bg-muted hover:bg-muted/80 rounded text-muted-foreground transition text-xs"
                            >
                              <X className="w-3 h-3 mx-auto" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("dashboard.targetWeight")}</span>
                      <span className="text-2xl font-bold text-foreground">{plan.targetWeightKg}</span>
                      <span className="text-xs text-muted-foreground">{t("common.kg")}</span>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-6 border-border">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-base mb-1">{t("dashboard.projectedTimeline")}</h3>
                    <p className="text-sm text-muted-foreground">{weightGapStr}</p>
                  </div>
                </div>
                {plan.weeksEstimateLow !== null && plan.weeksEstimateHigh !== null ? (
                  <div className="text-3xl font-light">
                    {plan.weeksEstimateLow} - {plan.weeksEstimateHigh} <span className="text-lg text-muted-foreground">{t("dashboard.weeks")}</span>
                  </div>
                ) : (
                  <div className="text-xl font-light text-muted-foreground">{t("dashboard.timelineNA")}</div>
                )}
                {plan.goalMode === "recomposition" && (
                  <p className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-lg border border-border/50">
                    {t("dashboard.recompositionNote")}
                  </p>
                )}
              </Card>
            </section>
          </>
        )}

        {/* ─── WEEKLY VIEW ─── */}
        {view === "weekly" && (
          <>
            {!weeklyData ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : (
              <>
                {/* Weekly totals */}
                <section className="space-y-3">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("dashboard.thisWeekNutrition")}</p>
                  <Card className="p-5 bg-[#1A1A1A] border-none space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{t("dashboard.consumed")}</div>
                        <div className="text-3xl font-bold text-primary">{Math.round(weeklyData.totals.calories)}</div>
                        <div className="text-xs text-muted-foreground">/ {plan.calorieTarget * 7} {t("common.kcal")} {t("dashboard.weekly")}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{t("dashboard.remaining")}</div>
                        <div className={`text-2xl font-bold ${plan.calorieTarget * 7 - weeklyData.totals.calories < 0 ? "text-red-400" : "text-foreground"}`}>
                          {Math.round(Math.max(0, plan.calorieTarget * 7 - weeklyData.totals.calories))}
                        </div>
                        <div className="text-xs text-muted-foreground">kcal</div>
                      </div>
                    </div>

                    <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (weeklyData.totals.calories / (plan.calorieTarget * 7)) * 100)}%` }}
                      />
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="text-xs text-muted-foreground grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <div className="font-semibold text-foreground text-sm">{Math.round(weeklyData.totals.protein_g)}g</div>
                          <div className="text-[10px]">{t("dashboard.protein")}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-foreground text-sm">{Math.round(weeklyData.totals.carbs_g)}g</div>
                          <div className="text-[10px]">{t("dashboard.carbs")}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-foreground text-sm">{Math.round(weeklyData.totals.fat_g)}g</div>
                          <div className="text-[10px]">{t("dashboard.fats")}</div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </section>

                {/* Weekly training */}
                <section className="space-y-3">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("dashboard.thisWeekTraining")}</p>
                  <Card className="p-5 bg-[#1A1A1A] border-none">
                    <div className="flex gap-3">
                      <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <Flame className="w-4 h-4 text-orange-400 mb-0.5" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("dashboard.totalBurned")}</span>
                        <span className="text-2xl font-bold text-orange-400">{Math.round(weeklyData.totals.burned_calories)}</span>
                        <span className="text-xs text-muted-foreground">{t("common.kcal")}</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider mt-5">{t("dashboard.dailyAvg")}</span>
                        <span className="text-2xl font-bold text-foreground">{Math.round(weeklyData.totals.burned_calories / 7)}</span>
                        <span className="text-xs text-muted-foreground">{t("dashboard.kcalPerDay")}</span>
                      </div>
                    </div>
                  </Card>
                </section>

                {/* Weekly Calorie Balance */}
                <section className="space-y-3">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("dashboard.calorieBalance")}</p>
                  <Card className="p-5 bg-[#1A1A1A] border-none space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("dashboard.consumed")}</span>
                        <span className="text-2xl font-bold text-foreground">{Math.round(weeklyData.totals.calories)}</span>
                        <span className="text-xs text-muted-foreground">{t("common.kcal")}</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("dashboard.burned")}</span>
                        <span className="text-2xl font-bold text-orange-400">{Math.round(weeklyData.totalBurned)}</span>
                        <span className="text-xs text-muted-foreground">{t("common.kcal")}</span>
                        <div className="text-[10px] text-muted-foreground mt-1 text-center">
                          <div>{Math.round((weeklyData.tdee ?? 0) * 7)} {t("dashboard.static")}</div>
                          {(weeklyData.totals.burned_calories ?? 0) > 0 && <div>+ {Math.round(weeklyData.totals.burned_calories)} {t("dashboard.workout")}</div>}
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("dashboard.net")}</span>
                        <span className={`text-2xl font-bold ${weeklyData.balance < 0 ? "text-primary" : "text-red-400"}`}>
                          {weeklyData.balance < 0 ? "−" : "+"}{Math.abs(Math.round(weeklyData.balance))}
                        </span>
                        <span className="text-xs text-muted-foreground">{weeklyData.balance < 0 ? t("dashboard.deficit") : t("dashboard.surplus")}</span>
                      </div>
                    </div>
                  </Card>
                </section>

                {/* Day-by-day chart */}
                <section className="space-y-3">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("dashboard.dayByDay")}</p>
                  <Card className="p-5 bg-[#1A1A1A] border-none space-y-4">
                    {/* Legend */}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Calories</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" /> Burned</span>
                    </div>
                    {weeklyData.days.map((day) => {
                      const calPct = weeklyMaxCal > 0 ? (day.calories / weeklyMaxCal) * 100 : 0;
                      const burnPct = weeklyMaxCal > 0 ? (day.burned_calories / weeklyMaxCal) * 100 : 0;
                      const isToday = day.date === today;
                      return (
                        <div key={day.date} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                              {day.day}{isToday ? ` (${t("dashboard.today")})` : ""}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(day.calories)} {t("common.kcal")} · {Math.round(day.burned_calories)} {t("dashboard.burned")}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${calPct}%` }}
                              />
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-orange-400 rounded-full transition-all duration-500"
                                style={{ width: `${burnPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                </section>
              </>
            )}
          </>
        )}

        {/* Quick Links — always visible */}
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("nutritionMeals.title")}</p>
          <Link href="/nutrition/meals">
            <Card className="p-4 border-border/50 bg-[#1A1A1A] flex items-center gap-4 hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{t("nutritionMeals.title")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t("nutritionMeals.createMeal")}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          </Link>
          <Link href="/nutrition/meal-plan">
            <Card className="p-4 border-border/50 bg-[#1A1A1A] flex items-center gap-4 hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{t("mealPlan.title")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t("mealPlan.compliance")}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          </Link>
          <Link href="/nutrition/shopping-list">
            <Card className="p-4 border-border/50 bg-[#1A1A1A] flex items-center gap-4 hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{t("shoppingList.title")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t("shoppingList.subtitle")}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          </Link>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("workoutPlan.title")}</p>
          <Link href="/training/builder">
            <Card className="p-4 border-border/50 bg-[#1A1A1A] flex items-center gap-4 hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Dumbbell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{t("trainingBuilder.title")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t("trainingBuilder.createExercise")}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          </Link>
          <Link href="/training/plan">
            <Card className="p-4 border-border/50 bg-[#1A1A1A] flex items-center gap-4 hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{t("workoutPlan.title")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t("workoutPlan.addWorkout")}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          </Link>
        </section>

      </main>
      <BottomNav />
    </div>
  );
}
