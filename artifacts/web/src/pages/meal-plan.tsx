import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2,
  Circle, Loader2, UtensilsCrossed, X, CalendarDays,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePlan } from "@/hooks/use-plan";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

// ── Date helpers ───────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDisplay(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  if (dateStr === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function offsetDate(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dy}`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface PortionRow {
  id: number;
  food_name: string;
  quantity_g: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes?: string | null;
}

interface MealSummary {
  id: number;
  meal_name: string;
  portions: PortionRow[];
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

interface PlanEntry {
  entry_id: number;
  meal: MealSummary | null;
  completed: boolean;
  completed_at: string | null;
}

interface DayPlan {
  date: string;
  entries: PlanEntry[];
  daily_totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

interface LibraryMeal {
  id: number;
  meal_name: string;
  portions: PortionRow[];
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

// ── Macro pill ─────────────────────────────────────────────────────────────────

function MacroPill({ label, value, unit, accent = false }: { label: string; value: number; unit: string; accent?: boolean }) {
  return (
    <div className={`flex-1 rounded-xl px-2 py-2.5 text-center ${accent ? "bg-primary/15 border border-primary/30" : "bg-[#1A1A1A]"}`}>
      <div className={`text-base font-bold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>
        {Math.round(value)}<span className="text-[10px] font-medium ml-0.5">{unit}</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

// ── Meal card ──────────────────────────────────────────────────────────────────

function MealCard({
  entry,
  date,
  onRemove,
  onToggleComplete,
}: {
  entry: PlanEntry;
  date: string;
  onRemove: () => void;
  onToggleComplete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meal = entry.meal;
  if (!meal) return null;

  return (
    <Card className={`bg-[#1A1A1A] border-border/40 overflow-hidden transition-all ${entry.completed ? "opacity-70" : ""}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Complete toggle */}
        <button
          onClick={onToggleComplete}
          className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
          aria-label={entry.completed ? "Mark incomplete" : "Mark complete"}
        >
          {entry.completed
            ? <CheckCircle2 className="w-6 h-6 text-primary" />
            : <Circle className="w-6 h-6" />}
        </button>

        {/* Meal name + expand */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left min-w-0"
        >
          <p className={`font-medium text-sm break-words ${entry.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {meal.meal_name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {Math.round(meal.totals.calories)} kcal · {Math.round(meal.totals.protein_g)}g P · {Math.round(meal.totals.carbs_g)}g C · {Math.round(meal.totals.fat_g)}g F
          </p>
        </button>

        {/* Remove */}
        <button
          onClick={onRemove}
          className="shrink-0 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove meal from day"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Portions list (collapsible) */}
      {expanded && meal.portions.length > 0 && (
        <div className="border-t border-border/30 px-4 py-3 space-y-3">
          {meal.portions.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="flex justify-between items-start gap-2 text-xs">
                <span className="flex-1 break-words text-foreground/80">{p.food_name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {p.serving_unit === "per_piece"
                    ? `${p.quantity_g} can${p.quantity_g !== 1 ? "s" : ""}`
                    : `${Math.round(p.quantity_g)}g`}
                  {" · "}
                  {Math.round(p.calories)} kcal
                </span>
              </div>
              {p.notes && (
                <p className="text-[10px] text-muted-foreground/70 italic pl-0">
                  Note: {p.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {expanded && meal.portions.length === 0 && (
        <div className="border-t border-border/30 px-4 py-3 text-xs text-muted-foreground">
          No foods added to this meal yet.
        </div>
      )}

      {/* Tap to expand hint if collapsed */}
      {!expanded && meal.portions.length > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-center text-[10px] text-muted-foreground/50 pb-2 hover:text-muted-foreground transition-colors"
        >
          {meal.portions.length} food{meal.portions.length !== 1 ? "s" : ""} · tap to view
        </button>
      )}
    </Card>
  );
}

// ── Add Meal Sheet ─────────────────────────────────────────────────────────────

function AddMealSheet({
  date,
  existingMealIds,
  onClose,
  onAdd,
  isAdding,
}: {
  date: string;
  existingMealIds: Set<number>;
  onClose: () => void;
  onAdd: (mealId: number) => void;
  isAdding: boolean;
}) {
  const { data: meals = [], isLoading, error } = useQuery<LibraryMeal[]>({
    queryKey: ["meals"],
    queryFn: () => customFetch<LibraryMeal[]>(`${BASE}/meals`),
    staleTime: 0,
    retry: 1,
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ maxWidth: 430, margin: "0 auto" }}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/60" onClick={onClose} />

      {/* Sheet */}
      <div className="bg-[#111111] border-t border-border/40 rounded-t-2xl flex flex-col max-h-[70vh]">
        {/* Handle + title */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/30">
          <h3 className="font-semibold text-sm">Add meal to {formatDisplay(date)}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {(isLoading || isAdding) && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && !isLoading && (
            <div className="text-center py-10 space-y-2">
              <div className="text-sm text-destructive">Failed to load meals</div>
              <p className="text-xs text-muted-foreground">Please try again</p>
            </div>
          )}

          {!isLoading && !error && meals.length === 0 && (
            <div className="text-center py-10 space-y-2">
              <UtensilsCrossed className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No meals yet</p>
              <Link href="/nutrition/meals" onClick={onClose}>
                <span className="text-xs text-primary underline underline-offset-2">Create meals in the Meal Builder</span>
              </Link>
            </div>
          )}

          {!isLoading && !error && meals.map((meal) => {
            const alreadyAdded = existingMealIds.has(meal.id);
            return (
              <button
                key={meal.id}
                onClick={() => !alreadyAdded && !isAdding && onAdd(meal.id)}
                disabled={alreadyAdded || isAdding}
                className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${
                  alreadyAdded || isAdding
                    ? "bg-[#1A1A1A] border-border/20 opacity-40 cursor-not-allowed"
                    : "bg-[#1A1A1A] border-border/40 hover:border-primary/40 active:scale-[0.99]"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="font-medium text-sm text-foreground">{meal.meal_name}</p>
                  {alreadyAdded && <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">Added</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {Math.round(meal.totals.calories)} kcal · {Math.round(meal.totals.protein_g)}g P · {Math.round(meal.totals.carbs_g)}g C · {Math.round(meal.totals.fat_g)}g F
                </p>
                {meal.portions.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 mt-1">No foods added yet</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MealPlan() {
  const [date, setDate] = useState(toDateStr(new Date()));
  const [showSheet, setShowSheet] = useState(false);
  const queryClient = useQueryClient();
  const today = toDateStr(new Date());

  const { data: dayPlan, isLoading } = useQuery<DayPlan>({
    queryKey: ["meal-plan", date],
    queryFn: () => customFetch<DayPlan>(`${BASE}/meal-plan?date=${date}`),
  });

  const { plan } = usePlan();

  const addMutation = useMutation({
    mutationFn: (mealId: number) =>
      customFetch(`${BASE}/meal-plan`, {
        method: "POST",
        body: JSON.stringify({ date, meal_id: mealId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plan", date] });
      setShowSheet(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (entryId: number) =>
      customFetch(`${BASE}/meal-plan/${entryId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-plan", date] }),
  });

  const completeMutation = useMutation({
    mutationFn: ({ entryId, completed }: { entryId: number; completed: boolean }) =>
      customFetch(`${BASE}/meal-plan/${entryId}/complete`, {
        method: completed ? "DELETE" : "POST",
      }),
    onMutate: async ({ entryId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["meal-plan", date] });
      const prev = queryClient.getQueryData<DayPlan>(["meal-plan", date]);
      if (prev) {
        queryClient.setQueryData<DayPlan>(["meal-plan", date], {
          ...prev,
          entries: prev.entries.map((e) =>
            e.entry_id === entryId
              ? { ...e, completed: !completed, completed_at: completed ? null : new Date().toISOString() }
              : e
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["meal-plan", date], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meal-plan", date] }),
  });

  const entries = dayPlan?.entries ?? [];
  const dailyTotals = dayPlan?.daily_totals ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const existingMealIds = useMemo(() => new Set(entries.map((e) => e.meal?.id ?? -1)), [entries]);

  const completedCount = entries.filter((e) => e.completed).length;

  return (
    <div className="mobile-container flex flex-col bg-background min-h-screen">
      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-xl z-20 border-b border-border/40">
        <Link href="/dashboard">
          <button className="w-9 h-9 flex items-center justify-center rounded-full border border-border/40 hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h1 className="text-base font-semibold">Meal Plan</h1>
        </div>
        {date !== today ? (
          <button
            onClick={() => setDate(today)}
            className="text-xs text-primary border border-primary/30 rounded-full px-3 py-1 hover:bg-primary/10 transition-colors"
          >
            Today
          </button>
        ) : (
          <div className="w-16" />
        )}
      </header>

      {/* Date navigator */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/20">
        <button
          onClick={() => setDate(offsetDate(date, -1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="font-semibold text-base">{formatDisplay(date)}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <button
          onClick={() => setDate(offsetDate(date, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Daily macro summary with progress */}
      <div className="px-5 py-4 border-b border-border/20 space-y-3">
        {/* Current vs Target */}
        <div className="flex gap-2">
          <MacroPill label="Cal" value={dailyTotals.calories} unit="kcal" accent />
          <MacroPill label="Protein" value={dailyTotals.protein_g} unit="g" />
          <MacroPill label="Carbs" value={dailyTotals.carbs_g} unit="g" />
          <MacroPill label="Fat" value={dailyTotals.fat_g} unit="g" />
        </div>

        {/* Target progress bars */}
        {plan && (
          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Calories</span>
                <span className="text-xs font-semibold text-foreground">
                  {Math.round(dailyTotals.calories)} / {plan.calorieTarget} kcal
                </span>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min((dailyTotals.calories / plan.calorieTarget) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Protein</span>
                <span className="text-xs font-semibold text-foreground">
                  {Math.round(dailyTotals.protein_g)} / {plan.proteinG}g
                </span>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min((dailyTotals.protein_g / plan.proteinG) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Carbs</span>
                <span className="text-xs font-semibold text-foreground">
                  {Math.round(dailyTotals.carbs_g)} / {plan.carbsG}g
                </span>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${Math.min((dailyTotals.carbs_g / plan.carbsG) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Fat</span>
                <span className="text-xs font-semibold text-foreground">
                  {Math.round(dailyTotals.fat_g)} / {plan.fatG}g
                </span>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 transition-all"
                  style={{ width: `${Math.min((dailyTotals.fat_g / plan.fatG) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Meals completion progress */}
        {entries.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Meals</span>
              <span className="text-xs font-semibold text-foreground">
                {completedCount} / {entries.length}
              </span>
            </div>
            <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${entries.length > 0 ? (completedCount / entries.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Meals list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-28">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[#1A1A1A] flex items-center justify-center">
              <UtensilsCrossed className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">No meals planned</p>
              <p className="text-xs text-muted-foreground mt-1">Add meals from your library to plan this day</p>
            </div>
          </div>
        )}

        {entries.map((entry) => (
          <MealCard
            key={entry.entry_id}
            entry={entry}
            date={date}
            onRemove={() => removeMutation.mutate(entry.entry_id)}
            onToggleComplete={() =>
              completeMutation.mutate({ entryId: entry.entry_id, completed: entry.completed })
            }
          />
        ))}
      </div>

      {/* Add Meal FAB */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30" style={{ width: "calc(min(430px, 100vw) - 40px)" }}>
        <Button
          onClick={() => setShowSheet(true)}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-sm gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Meal
        </Button>
      </div>

      {/* Add Meal Sheet */}
      {showSheet && (
        <AddMealSheet
          date={date}
          existingMealIds={existingMealIds}
          onClose={() => setShowSheet(false)}
          onAdd={(mealId) => addMutation.mutate(mealId)}
          isAdding={addMutation.isPending}
        />
      )}
    </div>
  );
}
