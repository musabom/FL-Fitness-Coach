import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Dumbbell,
  UtensilsCrossed, ShoppingCart, RotateCcw, Loader2, Moon, Hammer,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import BottomNav from "@/components/bottom-nav";
import { useCoachClient, useClientUrl } from "@/context/coach-client-context";
import { useLanguage } from "@/context/language-context";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

// ── date helpers ──────────────────────────────────────────────────────────────
function getTodayLocal() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function offsetDate(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── API shapes (subset of /workout-plan, /meal-plan, /dashboard/today) ────────
interface PlanExercise { id: number; exercise_name: string; image_url?: string | null; completed: boolean; }
interface WorkoutEntry {
  entry_id: number; is_entry: boolean; source?: "scheduled" | "cycle"; completed: boolean;
  workout: { id: number; workout_name: string; total_calories: number; exercises: PlanExercise[] };
}
interface DayWorkoutPlan { date: string; entries: WorkoutEntry[]; total_calories: number; burned_calories: number; is_calendar_rest_day?: boolean; }

interface MealSummary {
  id: number; meal_name: string;
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}
interface MealEntry { entry_id: number; meal: MealSummary | null; completed: boolean; }
interface DayMealPlan {
  date: string; entries: MealEntry[];
  daily_totals: { calories: number };
  consumed_totals: { calories: number };
}

interface TodayData {
  nutrition: { consumed: { calories: number }; planned: { calories: number } };
  training: { planned_calories: number; burned_calories: number };
}

// ── tiny UI pieces ────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[52px] h-[52px] rounded-[18px] bg-[#1B3260]/60 border border-[rgba(240,246,255,0.06)] flex items-center justify-center shrink-0 overflow-hidden">
      {children}
    </div>
  );
}

export default function Today() {
  const { t, lang } = useLanguage();
  const [date, setDate] = useState(getTodayLocal());
  const queryClient = useQueryClient();
  const { activeClient } = useCoachClient();
  const buildUrl = useClientUrl();
  const today = getTodayLocal();
  const isToday = date === today;

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString(
    lang === "ar" ? "ar" : "en-GB",
    { weekday: "long", day: "numeric", month: "long" },
  );

  // ── data ────────────────────────────────────────────────────────────────────
  const { data: workoutDay, isLoading: workoutsLoading } = useQuery<DayWorkoutPlan>({
    queryKey: ["workout-plan", date, activeClient?.id],
    queryFn: () => customFetch<DayWorkoutPlan>(buildUrl(`${BASE}/workout-plan?date=${date}`)),
    staleTime: 0, refetchOnMount: "always",
  });
  const { data: mealDay, isLoading: mealsLoading } = useQuery<DayMealPlan>({
    queryKey: ["meal-plan", date, activeClient?.id],
    queryFn: () => customFetch<DayMealPlan>(buildUrl(`${BASE}/meal-plan?date=${date}`)),
    staleTime: 0, refetchOnMount: "always",
  });
  const { data: summary } = useQuery<TodayData>({
    queryKey: ["dashboard-today", date, activeClient?.id],
    queryFn: () => customFetch<TodayData>(buildUrl(`${BASE}/dashboard/today?date=${date}`)),
    refetchInterval: 30000, staleTime: 0, refetchOnMount: "always",
  });

  // ── mutations (same endpoints/keys as the Meals & Training pages) ───────────
  const toggleWorkout = useMutation({
    mutationFn: ({ workoutId, completed }: { workoutId: number; completed: boolean }) => {
      if (completed) {
        return customFetch(buildUrl(`${BASE}/workout-plan/${workoutId}/complete?date=${date}`), { method: "DELETE" });
      }
      return customFetch(buildUrl(`${BASE}/workout-plan/${workoutId}/complete`), {
        method: "POST",
        body: JSON.stringify({ date }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-plan", date, activeClient?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-today", date, activeClient?.id] });
    },
  });

  const toggleMeal = useMutation({
    mutationFn: async ({ entryId, mealId, completed }: { entryId: number; mealId?: number; completed: boolean }) => {
      let actualEntryId = entryId;
      if (entryId === 0 && mealId) {
        const addRes = await customFetch<{ entry_id: number }>(buildUrl(`${BASE}/meal-plan`), {
          method: "POST",
          body: JSON.stringify({ date, meal_id: mealId }),
          headers: { "Content-Type": "application/json" },
        });
        actualEntryId = addRes.entry_id;
      }
      return customFetch(buildUrl(`${BASE}/meal-plan/${actualEntryId}/complete`), {
        method: completed ? "DELETE" : "POST",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plan", date, activeClient?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-today", date, activeClient?.id] });
    },
  });

  // ── derived ─────────────────────────────────────────────────────────────────
  const workouts = workoutDay?.entries ?? [];
  const meals = (mealDay?.entries ?? []).filter(e => e.meal);
  const workoutsDone = workouts.filter(w => w.completed).length;
  const caloriesGoal = summary?.nutrition.planned.calories ?? mealDay?.daily_totals.calories ?? 0;
  const caloriesEaten = summary?.nutrition.consumed.calories ?? mealDay?.consumed_totals.calories ?? 0;
  const burned = summary?.training.burned_calories ?? workoutDay?.burned_calories ?? 0;
  const isRestDay = !!workoutDay?.is_calendar_rest_day && workouts.length === 0;
  const loading = workoutsLoading || mealsLoading;

  const shortcuts = [
    { href: "/nutrition/meals", icon: UtensilsCrossed, label: t("today.mealBuilder") },
    { href: "/training/builder", icon: Hammer, label: t("today.workoutBuilder") },
    { href: "/nutrition/shopping-list", icon: ShoppingCart, label: t("today.shoppingList") },
    { href: "/training/cycle", icon: RotateCcw, label: t("today.trainingCycle") },
  ];

  return (
    <div className="mobile-container overflow-y-auto scrollbar-none pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-foreground">{t("today.title")}</h1>
      </div>

      {/* Date navigation */}
      <div className="px-4 py-2 flex items-center justify-between">
        <button onClick={() => setDate(offsetDate(date, -1))}
          className="w-10 h-10 rounded-full bg-[#0F1F3D] border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
        </button>
        <button onClick={() => setDate(today)} className="text-center">
          <p className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>{dateLabel}</p>
          {!isToday && <p className="text-[10px] text-muted-foreground">{t("today.title")} ↺</p>}
        </button>
        <button onClick={() => setDate(offsetDate(date, 1))}
          className="w-10 h-10 rounded-full bg-[#0F1F3D] border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
        </button>
      </div>

      {/* Summary card */}
      <div className="mx-4 mt-2 p-4 rounded-2xl bg-[#0F1F3D] border border-border/40 space-y-3">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("today.calories")}</span>
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{Math.round(caloriesEaten)}</span> / {Math.round(caloriesGoal)} {t("common.kcal")}
            </span>
          </div>
          <ProgressBar value={caloriesEaten} max={caloriesGoal} color="#2DD4BF" />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("today.workouts")}</span>
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{workoutsDone}</span> / {workouts.length}
              {burned > 0 && <span className="text-[#F97316]"> · {Math.round(burned)} {t("common.kcal")} {t("today.burned")}</span>}
            </span>
          </div>
          <ProgressBar value={workoutsDone} max={Math.max(1, workouts.length)} color="#F97316" />
        </div>
      </div>

      {/* Checklist */}
      <p className="px-5 mt-5 mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("today.yourDay")}</p>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : (
        <div className="px-4 space-y-2.5">
          {/* Rest day */}
          {isRestDay && (
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-3">
              <IconTile><Moon className="w-6 h-6 text-blue-300" /></IconTile>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-300">{t("today.restDay")}</p>
                <p className="text-xs text-blue-200/70 mt-0.5">{t("today.restDayDesc")}</p>
              </div>
            </div>
          )}

          {/* Workouts */}
          {workouts.map(entry => {
            const exs = entry.workout.exercises ?? [];
            const doneEx = exs.filter(e => e.completed).length;
            const thumb = exs.find(e => e.image_url)?.image_url;
            return (
              <div key={`w-${entry.workout.id}`}
                className={`p-3 rounded-2xl border transition-all ${entry.completed ? "bg-primary/5 border-primary/30 opacity-70" : "bg-[#0F1F3D] border-border/40"}`}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleWorkout.mutate({ workoutId: entry.workout.id, completed: entry.completed })}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors" aria-label={t("today.done")}>
                    {entry.completed
                      ? <CheckCircle2 className="w-6 h-6 text-primary" />
                      : <Circle className="w-6 h-6" />}
                  </button>
                  <IconTile>
                    {thumb
                      ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                      : <Dumbbell className="w-6 h-6 text-primary" />}
                  </IconTile>
                  <Link href="/training/plan" className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${entry.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {entry.workout.workout_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {exs.length} {t("today.exercisesShort")} · {Math.round(entry.workout.total_calories)} {t("common.kcal")}
                    </p>
                    {exs.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1"><ProgressBar value={doneEx} max={exs.length} color="#F97316" /></div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{doneEx}/{exs.length}</span>
                      </div>
                    )}
                  </Link>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 rtl:rotate-180" />
                </div>
              </div>
            );
          })}

          {!isRestDay && workouts.length === 0 && (
            <Link href="/training/plan"
              className="p-4 rounded-2xl bg-[#0F1F3D]/60 border border-dashed border-border/60 flex items-center gap-3 text-muted-foreground hover:border-primary/40">
              <IconTile><Dumbbell className="w-6 h-6" /></IconTile>
              <div className="flex-1">
                <p className="text-sm">{t("today.noWorkouts")}</p>
                <p className="text-xs text-primary mt-0.5">{t("today.planWorkout")}</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 rtl:rotate-180" />
            </Link>
          )}

          {/* Meals */}
          {meals.map(entry => {
            const m = entry.meal!;
            return (
              <div key={`m-${entry.entry_id}-${m.id}`}
                className={`p-3 rounded-2xl border transition-all ${entry.completed ? "bg-primary/5 border-primary/30 opacity-70" : "bg-[#0F1F3D] border-border/40"}`}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleMeal.mutate({ entryId: entry.entry_id, mealId: m.id, completed: entry.completed })}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors" aria-label={t("today.done")}>
                    {entry.completed
                      ? <CheckCircle2 className="w-6 h-6 text-primary" />
                      : <Circle className="w-6 h-6" />}
                  </button>
                  <IconTile><UtensilsCrossed className="w-6 h-6 text-[#F59E0B]" /></IconTile>
                  <Link href="/nutrition/meal-plan" className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${entry.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {m.meal_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {Math.round(m.totals.calories)} {t("common.kcal")}
                      <span className="text-[#3B82F6]"> · P {Math.round(m.totals.protein_g)}</span>
                      <span className="text-[#F59E0B]"> · C {Math.round(m.totals.carbs_g)}</span>
                      <span className="text-[#EAB308]"> · F {Math.round(m.totals.fat_g)}</span>
                    </p>
                  </Link>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 rtl:rotate-180" />
                </div>
              </div>
            );
          })}

          {meals.length === 0 && (
            <Link href="/nutrition/meal-plan"
              className="p-4 rounded-2xl bg-[#0F1F3D]/60 border border-dashed border-border/60 flex items-center gap-3 text-muted-foreground hover:border-primary/40">
              <IconTile><UtensilsCrossed className="w-6 h-6" /></IconTile>
              <div className="flex-1">
                <p className="text-sm">{t("today.noMeals")}</p>
                <p className="text-xs text-primary mt-0.5">{t("today.planMeals")}</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 rtl:rotate-180" />
            </Link>
          )}
        </div>
      )}

      {/* Shortcuts */}
      <p className="px-5 mt-6 mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("today.shortcuts")}</p>
      <div className="px-4 grid grid-cols-2 gap-2.5 mb-6">
        {shortcuts.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}
            className="p-3.5 rounded-2xl bg-[#0F1F3D] border border-border/40 flex items-center gap-2.5 hover:border-primary/40 transition-colors">
            <Icon className="w-4.5 h-4.5 w-[18px] h-[18px] text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground truncate">{label}</span>
          </Link>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
