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
import BottomNav from "@/components/bottom-nav";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

// ── Date helpers ──────────────────────────────────────────────────────────────

function getTodayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
const getTodayMuscat = getTodayLocal;

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplay(dateStr: string) {
  const today = getTodayLocal();
  if (dateStr === offsetDate(today, -1)) return "Yesterday";
  if (dateStr === today) return "Today";
  if (dateStr === offsetDate(today, 1)) return "Tomorrow";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function offsetDate(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

// ── Types ─────────────────────────────────────────────────────────────────────

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
  completed: boolean;
}

interface MealSummary {
  id: number;
  meal_name: string;
  portions: PortionRow[];
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  consumed_totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

interface PlanEntry {
  entry_id: number;
  meal: MealSummary | null;
  completed: boolean;
  completed_at: string | null;
  is_scheduled?: boolean;
}

interface DayPlan {
  date: string;
  entries: PlanEntry[];
  daily_totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  consumed_totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

interface LibraryMeal {
  id: number;
  meal_name: string;
  portions: PortionRow[];
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

// ── Macro pill ────────────────────────────────────────────────────────────────

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

// ── Calendar picker ───────────────────────────────────────────────────────────

function CalendarPicker({ selectedDate, onSelectDate, onClose }: { selectedDate: string; onSelectDate: (date: string) => void; onClose: () => void }) {
  const [calendarDate, setCalendarDate] = useState(selectedDate);
  const [year, month] = calendarDate.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  const monthName = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const firstDay = d.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = firstDay - 1; i >= 0; i--) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ maxWidth: 430, margin: "0 auto" }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#111111] border-t border-border/40 rounded-t-2xl w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <button onClick={() => { const p = new Date(year, month - 2, 1); setCalendarDate(`${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}-01`); }} className="p-2 hover:bg-muted rounded-lg">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-sm">{monthName}</h3>
          <button onClick={() => { const n = new Date(year, month, 1); setCalendarDate(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`); }} className="p-2 hover:bg-muted rounded-lg">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pt-3 pb-1 grid grid-cols-7 gap-1 text-[10px] font-medium text-muted-foreground uppercase">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="text-center py-1">{day}</div>
          ))}
        </div>
        <div className="px-5 pb-4 grid grid-cols-7 gap-1">
          {days.map((dayNum, idx) => {
            const isSelected = dayNum && `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` === selectedDate;
            return (
              <button key={idx} onClick={() => { if (!dayNum) return; onSelectDate(`${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`); onClose(); }} disabled={!dayNum}
                className={`aspect-square rounded-lg text-sm font-medium transition-colors ${!dayNum ? "text-muted-foreground/20 cursor-default" : isSelected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                {dayNum}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Meal card ─────────────────────────────────────────────────────────────────

function MealCard({ entry, onRemove, onToggleComplete, onTogglePortion }: {
  entry: PlanEntry;
  onRemove: () => void;
  onToggleComplete: () => void;
  onTogglePortion: (portionId: number, completed: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meal = entry.meal;
  if (!meal) return null;

  const completedCount = meal.portions.filter(p => p.completed).length;
  const total = meal.portions.length;

  return (
    <Card className={`bg-[#1A1A1A] border-border/40 overflow-hidden transition-all ${entry.completed ? "opacity-70" : ""}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button onClick={onToggleComplete} className="shrink-0 text-muted-foreground hover:text-primary transition-colors" aria-label={entry.completed ? "Mark incomplete" : "Mark complete"}>
          {entry.completed
            ? <CheckCircle2 className="w-6 h-6 text-primary" />
            : <Circle className="w-6 h-6" />}
        </button>

        <button onClick={() => setExpanded(v => !v)} className="flex-1 text-left min-w-0">
          <p className={`font-semibold text-sm break-words ${entry.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {meal.meal_name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {Math.round(meal.totals.calories)} kcal · {Math.round(meal.totals.protein_g)}g P · {Math.round(meal.totals.carbs_g)}g C · {Math.round(meal.totals.fat_g)}g F
          </p>
          {total > 0 && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{completedCount}/{total} eaten</p>}
        </button>

        <button onClick={onRemove} className="shrink-0 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" aria-label="Remove meal">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Portion progress bar */}
      {total > 0 && (
        <div className="px-4 pb-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(completedCount / total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Portions list (expandable with checkboxes) */}
      {expanded && meal.portions.length > 0 && (
        <div className="border-t border-border/30 px-4 divide-y divide-border/20">
          {meal.portions.map((p) => (
            <div key={p.id} className={`flex items-start gap-3 py-2.5 transition-opacity ${p.completed ? "opacity-50" : ""}`}>
              <button
                onClick={() => onTogglePortion(p.id, p.completed)}
                className="shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                aria-label={p.completed ? "Mark uneaten" : "Mark eaten"}
              >
                {p.completed
                  ? <CheckCircle2 className="w-5 h-5 text-primary" />
                  : <Circle className="w-5 h-5" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <span className={`text-sm font-medium break-words ${p.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {p.food_name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {p.serving_unit === "per_piece"
                      ? `${p.quantity_g} pc`
                      : `${Math.round(p.quantity_g)}g`}
                    {" · "}{Math.round(p.calories)} kcal
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {Math.round(p.protein_g)}g P · {Math.round(p.carbs_g)}g C · {Math.round(p.fat_g)}g F
                </div>
                {p.notes && <p className="text-[10px] text-muted-foreground/60 italic mt-0.5">Note: {p.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && meal.portions.length === 0 && (
        <div className="border-t border-border/30 px-4 py-3 text-xs text-muted-foreground">
          No foods added to this meal yet.
        </div>
      )}

      {/* Tap to expand hint */}
      {!expanded && meal.portions.length > 0 && (
        <button onClick={() => setExpanded(true)} className="w-full text-center text-[10px] text-muted-foreground/50 pb-2 hover:text-muted-foreground transition-colors">
          {meal.portions.length} food{meal.portions.length !== 1 ? "s" : ""} · tap to view
        </button>
      )}

      {/* Mark all eaten button when expanded */}
      {expanded && total > 0 && !entry.completed && (
        <div className="px-4 pb-3 pt-1">
          <button onClick={onToggleComplete}
            className={`w-full text-center rounded-xl py-2.5 text-xs font-semibold transition-all border ${completedCount === total ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border/30"}`}>
            {completedCount === total ? "Mark Meal Complete" : `Mark All Eaten (${total - completedCount} remaining)`}
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Add Meal Sheet ────────────────────────────────────────────────────────────

function AddMealSheet({ date, existingMealIds, onClose, onAdd, isAdding }: {
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
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="bg-[#111111] border-t border-border/40 rounded-t-2xl flex flex-col max-h-[70vh]">
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
            <div className="text-center py-10">
              <div className="text-sm text-destructive">Failed to load meals</div>
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
              <button key={meal.id} onClick={() => !alreadyAdded && !isAdding && onAdd(meal.id)} disabled={alreadyAdded || isAdding}
                className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${alreadyAdded ? "bg-[#1A1A1A] border-border/20 opacity-40 cursor-not-allowed" : "bg-[#1A1A1A] border-border/40 hover:border-primary/40 active:scale-[0.99]"}`}>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MealPlan() {
  const [date, setDate] = useState(getTodayMuscat());
  const [showSheet, setShowSheet] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const queryClient = useQueryClient();
  const today = getTodayMuscat();

  const { data: dayPlan, isLoading } = useQuery<DayPlan>({
    queryKey: ["meal-plan", date],
    queryFn: () => customFetch<DayPlan>(`${BASE}/meal-plan?date=${date}`),
  });

  const { plan } = usePlan();

  // ── Add meal ──────────────────────────────────────────────────────────────

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

  // ── Remove meal ───────────────────────────────────────────────────────────

  const removeMutation = useMutation({
    mutationFn: async ({ entryId, mealId, isScheduled }: { entryId: number; mealId?: number; isScheduled?: boolean }) => {
      if (isScheduled === false && mealId) {
        return customFetch(`${BASE}/meal-plan/${date}/exclude/${mealId}`, { method: "POST" });
      }
      return customFetch(`${BASE}/meal-plan/${entryId}`, { method: "DELETE" });
    },
    onMutate: async ({ entryId, mealId, isScheduled }) => {
      await queryClient.cancelQueries({ queryKey: ["meal-plan", date] });
      const prev = queryClient.getQueryData<DayPlan>(["meal-plan", date]);
      if (prev) {
        queryClient.setQueryData<DayPlan>(["meal-plan", date], {
          ...prev,
          entries: prev.entries.filter((e) => {
            if (isScheduled === false && mealId) return e.meal?.id !== mealId || e.is_scheduled === true;
            return e.entry_id !== entryId;
          }),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["meal-plan", date], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meal-plan", date] }),
  });

  // ── Toggle whole-meal complete ────────────────────────────────────────────

  const completeMutation = useMutation({
    mutationFn: async ({ entryId, mealId, completed }: { entryId: number; mealId?: number; completed: boolean }) => {
      let actualEntryId = entryId;
      if (entryId === 0 && mealId) {
        const addRes = await customFetch<{ entry_id: number }>(`${BASE}/meal-plan`, {
          method: "POST",
          body: JSON.stringify({ date, meal_id: mealId }),
        });
        actualEntryId = addRes.entry_id;
      }
      return customFetch(`${BASE}/meal-plan/${actualEntryId}/complete`, {
        method: completed ? "DELETE" : "POST",
      });
    },
    onMutate: async ({ entryId, mealId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["meal-plan", date] });
      const prev = queryClient.getQueryData<DayPlan>(["meal-plan", date]);
      if (prev) {
        queryClient.setQueryData<DayPlan>(["meal-plan", date], {
          ...prev,
          entries: prev.entries.map((e) => {
            const isMatch = entryId === 0 ? (e.entry_id === 0 && e.meal?.id === mealId) : e.entry_id === entryId;
            if (!isMatch) return e;
            const marking = !completed;
            const updatedPortions = e.meal?.portions.map(p => ({ ...p, completed: marking })) ?? [];
            const consumed_totals = marking
              ? { ...(e.meal?.totals ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }) }
              : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
            return {
              ...e,
              completed: marking,
              completed_at: marking ? new Date().toISOString() : null,
              meal: e.meal ? { ...e.meal, portions: updatedPortions, consumed_totals } : null,
            };
          }),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["meal-plan", date], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meal-plan", date] }),
  });

  // ── Toggle individual portion ─────────────────────────────────────────────

  const portionMutation = useMutation({
    mutationFn: async ({ mealId, portionId, completed }: { entryId: number; mealId: number; portionId: number; completed: boolean }) => {
      if (completed) {
        return customFetch(`${BASE}/meal-plan/${mealId}/portions/${portionId}/complete?date=${date}`, { method: "DELETE" });
      }
      return customFetch<{ meal_completed?: boolean }>(`${BASE}/meal-plan/${mealId}/portions/${portionId}/complete`, {
        method: "POST",
        body: JSON.stringify({ date }),
      });
    },
    onMutate: async ({ entryId, mealId, portionId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["meal-plan", date] });
      const prev = queryClient.getQueryData<DayPlan>(["meal-plan", date]);
      if (prev) {
        queryClient.setQueryData<DayPlan>(["meal-plan", date], {
          ...prev,
          entries: prev.entries.map((e) => {
            if (e.meal?.id !== mealId) return e;
            const updatedPortions = e.meal.portions.map(p =>
              p.id === portionId ? { ...p, completed: !completed } : p
            );
            const allDone = updatedPortions.length > 0 && updatedPortions.every(p => p.completed);
            const consumed_totals = {
              calories: updatedPortions.filter(p => p.completed).reduce((s, p) => s + p.calories, 0),
              protein_g: updatedPortions.filter(p => p.completed).reduce((s, p) => s + p.protein_g, 0),
              carbs_g: updatedPortions.filter(p => p.completed).reduce((s, p) => s + p.carbs_g, 0),
              fat_g: updatedPortions.filter(p => p.completed).reduce((s, p) => s + p.fat_g, 0),
            };
            return {
              ...e,
              completed: !completed ? (allDone ? true : e.completed) : false,
              meal: { ...e.meal, portions: updatedPortions, consumed_totals },
            };
          }),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["meal-plan", date], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meal-plan", date] }),
  });

  // ── Derived state ─────────────────────────────────────────────────────────

  const entries = dayPlan?.entries ?? [];
  const dailyTotals = dayPlan?.daily_totals ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  // Consumed = sum of completed portions across all meals
  const consumedTotals = useMemo(() => {
    return entries.reduce(
      (acc, e) => ({
        calories: acc.calories + (e.meal?.consumed_totals?.calories ?? 0),
        protein_g: acc.protein_g + (e.meal?.consumed_totals?.protein_g ?? 0),
        carbs_g: acc.carbs_g + (e.meal?.consumed_totals?.carbs_g ?? 0),
        fat_g: acc.fat_g + (e.meal?.consumed_totals?.fat_g ?? 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );
  }, [entries]);

  const existingMealIds = useMemo(() => new Set(entries.map(e => e.meal?.id ?? -1)), [entries]);
  const completedCount = entries.filter(e => e.completed).length;

  return (
    <div className="mobile-container flex flex-col bg-background min-h-screen pb-24">
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
          <button onClick={() => setDate(today)} className="text-xs text-primary border border-primary/30 rounded-full px-3 py-1 hover:bg-primary/10 transition-colors">
            Today
          </button>
        ) : (
          <div className="w-16" />
        )}
      </header>

      {/* Date navigator */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/20">
        <button onClick={() => setDate(offsetDate(date, -1))} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={() => setShowCalendar(true)} className="text-center hover:opacity-70 transition-opacity flex-1">
          <p className="font-semibold text-base">{formatDisplay(date)}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </button>
        <button onClick={() => setDate(offsetDate(date, 1))} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Daily summary */}
      <div className="px-5 py-4 border-b border-border/20 space-y-3">
        {/* Planned / Completed / Remaining pills */}
        <div className="flex gap-2">
          {/* Planned */}
          <div className="flex-1 rounded-xl px-2 py-2.5 text-center bg-primary/15 border border-primary/30">
            <div className="text-base font-bold tabular-nums text-primary">
              {Math.round(dailyTotals.calories)}<span className="text-[10px] font-medium ml-0.5">kcal</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Planned</div>
          </div>
          {/* Completed */}
          <div className="flex-1 rounded-xl px-2 py-2.5 text-center bg-[#1A1A1A]">
            <div className="text-base font-bold tabular-nums text-foreground">
              {Math.round(consumedTotals.calories)}<span className="text-[10px] font-medium ml-0.5">kcal</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Completed</div>
          </div>
          {/* Remaining */}
          <div className="flex-1 rounded-xl px-2 py-2.5 text-center bg-[#1A1A1A]">
            <div className="text-base font-bold tabular-nums text-foreground">
              {Math.round(Math.max(0, dailyTotals.calories - consumedTotals.calories))}<span className="text-[10px] font-medium ml-0.5">kcal</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Remaining</div>
          </div>
        </div>

        {/* Progress bars vs target */}
        {plan && (
          <div className="space-y-3">
            {/* Calories */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Calories</span>
                <span className="text-xs font-semibold text-foreground">
                  {Math.round(consumedTotals.calories)} / {plan.calorieTarget} kcal
                </span>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden mb-1">
                <div className="h-full bg-primary transition-all" style={{ width: `${Math.min((dailyTotals.calories / plan.calorieTarget) * 100, 100)}%` }} />
              </div>
              <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 transition-all" style={{ width: `${Math.min((consumedTotals.calories / plan.calorieTarget) * 100, 100)}%` }} />
              </div>
            </div>

            {/* Protein */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Protein</span>
                <span className="text-xs font-semibold text-foreground">
                  {Math.round(consumedTotals.protein_g)} / {plan.proteinG}g
                </span>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden mb-1">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.min((dailyTotals.protein_g / plan.proteinG) * 100, 100)}%` }} />
              </div>
              <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500/70 transition-all" style={{ width: `${Math.min((consumedTotals.protein_g / plan.proteinG) * 100, 100)}%` }} />
              </div>
            </div>

            {/* Carbs */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Carbs</span>
                <span className="text-xs font-semibold text-foreground">
                  {Math.round(consumedTotals.carbs_g)} / {plan.carbsG}g
                </span>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden mb-1">
                <div className="h-full bg-amber-400 transition-all" style={{ width: `${Math.min((dailyTotals.carbs_g / plan.carbsG) * 100, 100)}%` }} />
              </div>
              <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div className="h-full bg-amber-400/70 transition-all" style={{ width: `${Math.min((consumedTotals.carbs_g / plan.carbsG) * 100, 100)}%` }} />
              </div>
            </div>

            {/* Fat */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Fat</span>
                <span className="text-xs font-semibold text-foreground">
                  {Math.round(consumedTotals.fat_g)} / {plan.fatG}g
                </span>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden mb-1">
                <div className="h-full bg-yellow-400 transition-all" style={{ width: `${Math.min((dailyTotals.fat_g / plan.fatG) * 100, 100)}%` }} />
              </div>
              <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400/70 transition-all" style={{ width: `${Math.min((consumedTotals.fat_g / plan.fatG) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Meals completion progress */}
        {entries.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Meals</span>
              <span className="text-xs font-semibold text-foreground">{completedCount} / {entries.length}</span>
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
            key={`${entry.is_scheduled === false ? "sched" : "entry"}-${entry.is_scheduled === false ? entry.meal?.id : entry.entry_id}`}
            entry={entry}
            onRemove={() => removeMutation.mutate({ entryId: entry.entry_id, mealId: entry.meal?.id, isScheduled: entry.is_scheduled })}
            onToggleComplete={() => completeMutation.mutate({ entryId: entry.entry_id, mealId: entry.meal?.id, completed: entry.completed })}
            onTogglePortion={(portionId, completed) => {
              if (entry.meal) {
                portionMutation.mutate({ entryId: entry.entry_id, mealId: entry.meal.id, portionId, completed });
              }
            }}
          />
        ))}
      </div>

      {/* Add Meal FAB */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30" style={{ width: "calc(min(430px, 100vw) - 40px)" }}>
        <Button onClick={() => setShowSheet(true)} className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-sm gap-2">
          <Plus className="w-4 h-4" />
          Add Meal
        </Button>
      </div>

      {showSheet && (
        <AddMealSheet
          date={date}
          existingMealIds={existingMealIds}
          onClose={() => setShowSheet(false)}
          onAdd={(mealId) => addMutation.mutate(mealId)}
          isAdding={addMutation.isPending}
        />
      )}

      {showCalendar && (
        <CalendarPicker
          selectedDate={date}
          onSelectDate={setDate}
          onClose={() => setShowCalendar(false)}
        />
      )}
      <BottomNav />
    </div>
  );
}
