import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlan } from "@/hooks/use-plan";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  Settings, LogOut, Loader2, ChevronRight, ChevronDown,
  UtensilsCrossed, CalendarDays, ShoppingCart, Dumbbell, ClipboardList, Flame, Zap, Edit2, Check, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { customFetch, getGetActivePlanQueryKey } from "@workspace/api-client-react";

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
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const today = todayStr();

  const { data: todayData, refetch: refetchToday } = useQuery<TodayData>({
    queryKey: ["dashboard-today", today],
    queryFn: () => customFetch<TodayData>(`${BASE}/dashboard/today?date=${today}`),
    enabled: !!plan,
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  const mondayStr = getMondayStr();
  const { data: weeklyData } = useQuery<WeeklyData>({
    queryKey: ["dashboard-weekly", mondayStr],
    queryFn: () => customFetch<WeeklyData>(`${BASE}/dashboard/weekly?week_start=${mondayStr}`),
    enabled: view === "weekly" && !!plan,
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
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

  if (!plan) {
    return (
      <div className="mobile-container flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-bold mb-2">No active plan</h2>
        <p className="text-muted-foreground mb-6">You need to complete onboarding to get your plan.</p>
        <Link href="/onboarding" className="w-full">
          <Button className="w-full">Start Onboarding</Button>
        </Link>
      </div>
    );
  }

  const goalLabels: Record<string, string> = {
    recomposition: "Lose fat & preserve muscle",
    cut: "Lose body fat",
    lean_bulk: "Build lean muscle",
    maintenance: "Maintain weight",
  };

  const weightGapStr = plan.weightKg > plan.targetWeightKg
    ? `You want to lose ${(plan.weightKg - plan.targetWeightKg).toFixed(1)} kg`
    : plan.weightKg < plan.targetWeightKg
      ? `You want to gain ${(plan.targetWeightKg - plan.weightKg).toFixed(1)} kg`
      : "You are at your target weight";

  return (
    <div className="mobile-container overflow-y-auto scrollbar-none pb-12">
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center sticky top-0 bg-background/80 backdrop-blur-xl z-10 border-b border-border/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/profile/edit" className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
            <Settings className="w-5 h-5 text-foreground" />
          </Link>
          <button
            onClick={() => logout.mutate()}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-6 pt-6 space-y-6">

        {/* Toggle */}
        <div className="flex gap-1 p-1 bg-[#1A1A1A] rounded-2xl">
          <button
            onClick={() => setView("daily")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${view === "daily" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            Daily
          </button>
          <button
            onClick={() => setView("weekly")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${view === "weekly" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            Weekly
          </button>
        </div>

        {/* ─── DAILY VIEW ─── */}
        {view === "daily" && (
          <>
            {/* Calorie Target hero */}
            <section className="flex flex-col items-center py-4">
              <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3">Daily Target</div>
              <div className="text-7xl font-light tracking-tighter text-primary">{plan.calorieTarget}</div>
              <div className="text-sm text-muted-foreground mt-1">kcal</div>
              <div className="mt-4 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                {goalLabels[plan.goalMode] || plan.goalMode}
              </div>
            </section>

            {/* Calorie Balance */}
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
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Net</span>
                    <span className={`text-2xl font-bold ${(todayData?.balance ?? 0) < 0 ? "text-primary" : "text-red-400"}`}>
                      {(todayData?.balance ?? 0) < 0 ? "−" : "+"}{Math.abs(Math.round(todayData?.balance ?? 0))}
                    </span>
                    <span className="text-xs text-muted-foreground">{(todayData?.balance ?? 0) < 0 ? "deficit" : "surplus"}</span>
                  </div>
                </div>
              </Card>
            </section>

            {/* Daily Nutrition Progress — Compact bars */}
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

            {/* Daily Workout Burn */}
            <section className="space-y-3">
              <button
                onClick={() => setCollapsedTraining(!collapsedTraining)}
                className="w-full flex items-center justify-between p-0"
              >
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Today's Training</p>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsedTraining ? "rotate-180" : ""}`} />
              </button>
              {!collapsedTraining && (
                <Card className="p-5 bg-[#1A1A1A] border-none space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <Zap className="w-4 h-4 text-muted-foreground mb-0.5" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Planned</span>
                      <span className="text-2xl font-bold text-foreground">{Math.round(training.planned_calories)}</span>
                      <span className="text-xs text-muted-foreground">kcal</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <Flame className="w-4 h-4 text-orange-400 mb-0.5" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Burned</span>
                      <span className="text-2xl font-bold text-orange-400">{Math.round(training.burned_calories)}</span>
                      <span className="text-xs text-muted-foreground">kcal</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider mt-5">Remaining</span>
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
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Weight</p>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsedWeight ? "rotate-180" : ""}`} />
              </button>
              {!collapsedWeight && (
                <Card className="p-5 bg-[#1A1A1A] border-none space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Started</span>
                      <span className="text-2xl font-bold text-foreground">{Math.round((plan.startedWeightKg ?? plan.weightKg) * 10) / 10}</span>
                      <span className="text-xs text-muted-foreground">kg</span>
                      <p className="text-[10px] text-muted-foreground mt-1">Read-only</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Current</span>
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
                            <Edit2 className="w-3 h-3" /> Edit
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
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Target</span>
                      <span className="text-2xl font-bold text-foreground">{plan.targetWeightKg}</span>
                      <span className="text-xs text-muted-foreground">kg</span>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-6 border-border">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-base mb-1">Projected Timeline</h3>
                    <p className="text-sm text-muted-foreground">{weightGapStr}</p>
                  </div>
                </div>
                {plan.weeksEstimateLow !== null && plan.weeksEstimateHigh !== null ? (
                  <div className="text-3xl font-light">
                    {plan.weeksEstimateLow} - {plan.weeksEstimateHigh} <span className="text-lg text-muted-foreground">weeks</span>
                  </div>
                ) : (
                  <div className="text-xl font-light text-muted-foreground">Timeline N/A</div>
                )}
                {plan.goalMode === "recomposition" && (
                  <p className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-lg border border-border/50">
                    Your weight may not change much — recomposition replaces fat with muscle.
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
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">This Week — Nutrition</p>
                  <Card className="p-5 bg-[#1A1A1A] border-none space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Consumed</div>
                        <div className="text-3xl font-bold text-primary">{Math.round(weeklyData.totals.calories)}</div>
                        <div className="text-xs text-muted-foreground">/ {plan.calorieTarget * 7} kcal weekly</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Remaining</div>
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
                          <div className="text-[10px]">Protein</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-foreground text-sm">{Math.round(weeklyData.totals.carbs_g)}g</div>
                          <div className="text-[10px]">Carbs</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-foreground text-sm">{Math.round(weeklyData.totals.fat_g)}g</div>
                          <div className="text-[10px]">Fat</div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </section>

                {/* Weekly training */}
                <section className="space-y-3">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">This Week — Training</p>
                  <Card className="p-5 bg-[#1A1A1A] border-none">
                    <div className="flex gap-3">
                      <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <Flame className="w-4 h-4 text-orange-400 mb-0.5" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Burned</span>
                        <span className="text-2xl font-bold text-orange-400">{Math.round(weeklyData.totals.burned_calories)}</span>
                        <span className="text-xs text-muted-foreground">kcal</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider mt-5">Daily Avg</span>
                        <span className="text-2xl font-bold text-foreground">{Math.round(weeklyData.totals.burned_calories / 7)}</span>
                        <span className="text-xs text-muted-foreground">kcal/day</span>
                      </div>
                    </div>
                  </Card>
                </section>

                {/* Weekly Calorie Balance */}
                <section className="space-y-3">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Calorie Balance</p>
                  <Card className="p-5 bg-[#1A1A1A] border-none space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Consumed</span>
                        <span className="text-2xl font-bold text-foreground">{Math.round(weeklyData.totals.calories)}</span>
                        <span className="text-xs text-muted-foreground">kcal</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Burned</span>
                        <span className="text-2xl font-bold text-orange-400">{Math.round(weeklyData.totalBurned)}</span>
                        <span className="text-xs text-muted-foreground">kcal</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Net</span>
                        <span className={`text-2xl font-bold ${weeklyData.balance < 0 ? "text-primary" : "text-red-400"}`}>
                          {weeklyData.balance < 0 ? "−" : "+"}{Math.abs(Math.round(weeklyData.balance))}
                        </span>
                        <span className="text-xs text-muted-foreground">{weeklyData.balance < 0 ? "deficit" : "surplus"}</span>
                      </div>
                    </div>
                  </Card>
                </section>

                {/* Day-by-day chart */}
                <section className="space-y-3">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Day by Day</p>
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
                              {day.day}{isToday ? " (today)" : ""}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(day.calories)} kcal · {Math.round(day.burned_calories)} burned
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
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Nutrition</p>
          <Link href="/nutrition/meals">
            <Card className="p-4 border-border/50 bg-[#1A1A1A] flex items-center gap-4 hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">Meal Builder</div>
                <div className="text-xs text-muted-foreground mt-0.5">Create and manage your meals</div>
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
                <div className="font-semibold text-sm">Meal Plan</div>
                <div className="text-xs text-muted-foreground mt-0.5">Track meals day by day</div>
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
                <div className="font-semibold text-sm">Shopping List</div>
                <div className="text-xs text-muted-foreground mt-0.5">Weekly ingredients &amp; stock tracker</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          </Link>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Training</p>
          <Link href="/training/builder">
            <Card className="p-4 border-border/50 bg-[#1A1A1A] flex items-center gap-4 hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Dumbbell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">Exercise Builder</div>
                <div className="text-xs text-muted-foreground mt-0.5">Build workouts &amp; track calorie burn</div>
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
                <div className="font-semibold text-sm">Workout Plan</div>
                <div className="text-xs text-muted-foreground mt-0.5">Track today's scheduled workouts</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          </Link>
        </section>

      </main>
    </div>
  );
}
