import { useState, useMemo } from "react";
import { useLanguage } from "@/context/language-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2,
  Circle, Loader2, UtensilsCrossed, X, CalendarDays, ArrowLeft, UserCheck,
  Repeat, RotateCcw, Search,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePlan } from "@/hooks/use-plan";
import BottomNav from "@/components/bottom-nav";
import { useCoachClient, useClientUrl } from "@/context/coach-client-context";

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
  overridden?: boolean;
  is_extra?: boolean;
  extra_id?: number;
}

interface MealSummary {
  id: number;
  meal_name: string;
  portions: PortionRow[];
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  consumed_totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  modified?: boolean;
}

interface PickedFood {
  id: number; food_name: string; serving_unit: string;
  calories: number; source: "database" | "user";
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

function MacroPill({ label, value, unit, accent = false, color }: { label: string; value: number; unit: string; accent?: boolean; color?: string }) {
  return (
    <div className={`flex-1 rounded-xl px-1.5 py-2 text-center border ${accent ? "bg-primary/15 border-primary/30" : "bg-[#0B1630]/70 border-white/5"}`}>
      <div className={`text-sm font-bold tabular-nums ${accent ? "text-primary" : "text-foreground"}`} style={!accent && color ? { color } : undefined}>
        {Math.round(value)}<span className="text-[9px] font-medium ml-0.5 text-muted-foreground">{unit}</span>
      </div>
      <div className="text-[9px] text-muted-foreground mt-0.5">{label}</div>
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

// ── Food picker (day-only swap / add) ─────────────────────────────────────────

function FoodPickerSheet({ title, onConfirm, onClose }: {
  title: string;
  onConfirm: (food: PickedFood, quantity: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<PickedFood | null>(null);
  const [qty, setQty] = useState("");
  const buildUrl = useClientUrl();
  const { data: foods = [], isLoading } = useQuery<PickedFood[]>({
    queryKey: ["food-search", q],
    queryFn: () => customFetch<PickedFood[]>(buildUrl(`${BASE}/foods/search?q=${encodeURIComponent(q)}`)),
  });
  const shown = foods.slice(0, 30);
  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-[#0F1F3D] border-t border-border/50 rounded-t-3xl p-5 pb-8 max-h-[75vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-foreground">{title} <span className="text-[10px] font-medium text-amber-400">· today only</span></p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {!picked ? (
          <>
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search foods..."
                className="w-full rounded-xl bg-[#1B3260]/50 border border-border/40 text-sm text-foreground ps-9 pe-3 py-2.5 focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="overflow-y-auto flex-1 space-y-1.5">
              {isLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>}
              {!isLoading && shown.map(f => (
                <button key={`${f.source}-${f.id}`}
                  onClick={() => { setPicked(f); setQty(f.serving_unit === "per_piece" ? "1" : "100"); }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#1B3260]/40 border border-border/30 hover:border-primary/40">
                  <span className="text-sm font-medium text-foreground">{f.food_name}</span>
                  <span className="text-[10px] text-muted-foreground ms-2">
                    {Math.round(f.calories)} kcal / {f.serving_unit === "per_piece" ? "pc" : "100g"}
                  </span>
                </button>
              ))}
              {!isLoading && shown.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No foods found</p>}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-foreground font-medium">{picked.food_name}</p>
            <div className="flex items-center gap-2">
              <input
                autoFocus type="number" min="0.1" step="any" value={qty} onChange={e => setQty(e.target.value)}
                className="flex-1 rounded-xl bg-[#1B3260]/50 border border-border/40 text-sm text-foreground px-3 py-2.5 focus:outline-none focus:border-primary/50"
              />
              <span className="text-xs text-muted-foreground w-10">{picked.serving_unit === "per_piece" ? "pc" : "g"}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPicked(null)} className="flex-1 rounded-xl py-2.5 text-xs font-semibold bg-muted text-muted-foreground">Back</button>
              <button
                onClick={() => { const n = Number(qty); if (n > 0) onConfirm(picked, n); }}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold bg-primary text-[#081025]">
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MealCard({ entry, onRemove, onToggleComplete, onTogglePortion, onOverrideQty, onRemoveToday, onSwapRequest, onAddFoodRequest, onToggleExtra, onDeleteExtra, onResetMeal }: {
  entry: PlanEntry;
  onRemove: () => void;
  onToggleComplete: () => void;
  onTogglePortion: (portionId: number, completed: boolean) => void;
  onOverrideQty: (portionId: number, quantity: number) => void;
  onRemoveToday: (portionId: number) => void;
  onSwapRequest: (portionId: number) => void;
  onAddFoodRequest: () => void;
  onToggleExtra: (extraId: number) => void;
  onDeleteExtra: (extraId: number) => void;
  onResetMeal: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingQty, setEditingQty] = useState<{ id: number; value: string } | null>(null);
  const meal = entry.meal;
  if (!meal) return null;

  const commitQty = (portionId: number) => {
    const n = Number(editingQty?.value);
    setEditingQty(null);
    if (n > 0) onOverrideQty(portionId, n);
  };

  const completedCount = meal.portions.filter(p => p.completed).length;
  const total = meal.portions.length;

  return (
    <Card className={`bg-[#0F1F3D] border-[rgba(240,246,255,0.06)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.4)] overflow-hidden transition-all ${entry.completed ? "opacity-60" : ""}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2.5">
        <button onClick={onToggleComplete} className="shrink-0 text-muted-foreground hover:text-primary transition-colors" aria-label={entry.completed ? "Mark incomplete" : "Mark complete"}>
          {entry.completed
            ? <CheckCircle2 className="w-6 h-6 text-primary" />
            : <Circle className="w-6 h-6" />}
        </button>

        <button onClick={() => setExpanded(v => !v)} className="flex-1 text-left min-w-0">
          <p className={`font-bold text-[15px] break-words ${entry.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {meal.meal_name}
          </p>
          {total > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {total} food{total !== 1 ? "s" : ""} · {completedCount}/{total} eaten
              {meal.modified && <span className="text-amber-400 font-semibold"> · edited today</span>}
            </p>
          )}
        </button>

        {meal.modified && (
          <button onClick={onResetMeal} className="shrink-0 w-8 h-8 flex items-center justify-center text-amber-400/80 hover:text-amber-300 transition-colors" aria-label="Reset to plan" title="Reset to plan">
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        <button onClick={onRemove} className="shrink-0 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" aria-label="Remove meal">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Macro pills */}
      <div className="flex gap-1.5 px-4 pb-3">
        <MacroPill label="Cal" value={meal.totals.calories} unit="" accent />
        <MacroPill label="Protein" value={meal.totals.protein_g} unit="g" color="#3B82F6" />
        <MacroPill label="Carbs" value={meal.totals.carbs_g} unit="g" color="#F59E0B" />
        <MacroPill label="Fat" value={meal.totals.fat_g} unit="g" color="#EAB308" />
      </div>

      {/* Portion progress bar */}
      {total > 0 && (
        <div className="px-4 pb-2">
          <div className="h-1 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(completedCount / total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Portions list (expandable with checkboxes + day-only edits) */}
      {expanded && meal.portions.length > 0 && (
        <div className="border-t border-border/30 px-4 divide-y divide-border/20">
          {meal.portions.map((p) => (
            <div key={p.id} className={`flex items-start gap-3 py-2.5 transition-opacity ${p.completed ? "opacity-50" : ""}`}>
              <button
                onClick={() => p.is_extra ? onToggleExtra(p.extra_id!) : onTogglePortion(p.id, p.completed)}
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
                    {p.is_extra && <span className="ms-1.5 text-[9px] font-bold text-primary bg-primary/15 rounded px-1 py-0.5 align-middle">today</span>}
                    {!p.is_extra && p.overridden && <span className="ms-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle" title="Edited today" />}
                  </span>
                  {editingQty?.id === p.id && !p.is_extra ? (
                    <span className="shrink-0 flex items-center gap-1">
                      <input
                        autoFocus type="number" min="0.1" step="any" value={editingQty.value}
                        onChange={e => setEditingQty({ id: p.id, value: e.target.value })}
                        onBlur={() => commitQty(p.id)}
                        onKeyDown={e => { if (e.key === "Enter") commitQty(p.id); if (e.key === "Escape") setEditingQty(null); }}
                        className="w-16 rounded-lg bg-[#1B3260]/60 border border-primary/40 text-xs text-foreground px-2 py-1 focus:outline-none"
                      />
                      <span className="text-[10px] text-muted-foreground">{p.serving_unit === "per_piece" ? "pc" : "g"}</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => !p.is_extra && setEditingQty({ id: p.id, value: String(p.quantity_g) })}
                      className={`shrink-0 text-xs tabular-nums ${p.is_extra ? "text-muted-foreground" : "text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-primary"}`}
                      title={p.is_extra ? undefined : "Change quantity for today"}
                    >
                      {p.serving_unit === "per_piece" ? `${p.quantity_g} pc` : `${Math.round(p.quantity_g)}g`}
                      {" · "}{Math.round(p.calories)} kcal
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(p.protein_g)}g P · {Math.round(p.carbs_g)}g C · {Math.round(p.fat_g)}g F
                  </span>
                  <span className="flex items-center gap-2.5 shrink-0">
                    {p.is_extra ? (
                      <button onClick={() => onDeleteExtra(p.extra_id!)} className="text-muted-foreground hover:text-destructive" title="Remove added food">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <>
                        <button onClick={() => onSwapRequest(p.id)} className="text-muted-foreground hover:text-primary" title="Swap food for today">
                          <Repeat className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onRemoveToday(p.id)} className="text-muted-foreground hover:text-amber-400" title="Remove for today">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </span>
                </div>
                {p.notes && <p className="text-[10px] text-muted-foreground/60 italic mt-0.5">Note: {p.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add a food for today only */}
      {expanded && (
        <button onClick={onAddFoodRequest}
          className="mx-4 mb-1 mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80">
          <Plus className="w-3.5 h-3.5" /> Add food · today only
        </button>
      )}

      {expanded && meal.portions.length === 0 && (
        <div className="border-t border-border/30 px-4 py-3 text-xs text-muted-foreground">
          No foods added to this meal yet.
        </div>
      )}

      {/* Tap to expand hint */}
      {!expanded && meal.portions.length > 0 && (
        <button onClick={() => setExpanded(true)} className="w-full text-center text-[10px] text-muted-foreground/50 pb-1 hover:text-muted-foreground transition-colors">
          {meal.portions.length} food{meal.portions.length !== 1 ? "s" : ""} · tap to view
        </button>
      )}

      {/* Log meal CTA */}
      <div className="px-4 pb-4 pt-1.5">
        <button
          onClick={onToggleComplete}
          className={`w-full text-center rounded-2xl py-3 text-sm font-bold transition-all ${
            entry.completed
              ? "bg-primary/10 text-primary border border-primary/30"
              : "bg-primary text-[#081025] shadow-[0_6px_20px_-6px_rgba(45,212,191,0.5)] active:scale-[0.99]"
          }`}
        >
          {entry.completed ? "Logged ✓ · tap to undo" : "Log Meal"}
        </button>
      </div>
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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ maxWidth: 672, margin: "0 auto" }}>
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="bg-[#111111] border-t border-border/40 rounded-t-2xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/30">
          <h3 className="font-semibold text-sm">Add meal to {formatDisplay(date)}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2 pb-20">
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
                className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${alreadyAdded ? "bg-[#0F1F3D] border-border/20 opacity-40 cursor-not-allowed" : "bg-[#0F1F3D] border-border/40 hover:border-primary/40 active:scale-[0.99]"}`}>
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
  const { t } = useLanguage();
  const [date, setDate] = useState(getTodayMuscat());
  const [showSheet, setShowSheet] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const queryClient = useQueryClient();
  const { activeClient, setActiveClient } = useCoachClient();
  const buildUrl = useClientUrl();
  const [, setLocation] = useLocation();
  const today = getTodayMuscat();

  const { data: dayPlan, isLoading } = useQuery<DayPlan>({
    queryKey: ["meal-plan", date, activeClient?.id],
    queryFn: () => customFetch<DayPlan>(buildUrl(`${BASE}/meal-plan?date=${date}`)),
  });

  const { plan } = usePlan();

  // ── Add meal ──────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: (mealId: number) =>
      customFetch(buildUrl(`${BASE}/meal-plan`), {
        method: "POST",
        body: JSON.stringify({ date, meal_id: mealId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plan", date, activeClient?.id] });
      setShowSheet(false);
    },
  });

  // ── Remove meal ───────────────────────────────────────────────────────────

  const removeMutation = useMutation({
    mutationFn: async ({ entryId, mealId, isScheduled }: { entryId: number; mealId?: number; isScheduled?: boolean }) => {
      if (isScheduled === false && mealId) {
        return customFetch(buildUrl(`${BASE}/meal-plan/${date}/exclude/${mealId}`), { method: "POST" });
      }
      return customFetch(buildUrl(`${BASE}/meal-plan/${entryId}`), { method: "DELETE" });
    },
    onMutate: async ({ entryId, mealId, isScheduled }) => {
      await queryClient.cancelQueries({ queryKey: ["meal-plan", date, activeClient?.id] });
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meal-plan", date, activeClient?.id] }),
  });

  // ── Toggle whole-meal complete ────────────────────────────────────────────

  const completeMutation = useMutation({
    mutationFn: async ({ entryId, mealId, completed }: { entryId: number; mealId?: number; completed: boolean }) => {
      let actualEntryId = entryId;
      if (entryId === 0 && mealId) {
        const addRes = await customFetch<{ entry_id: number }>(buildUrl(`${BASE}/meal-plan`), {
          method: "POST",
          body: JSON.stringify({ date, meal_id: mealId }),
        });
        actualEntryId = addRes.entry_id;
      }
      return customFetch(buildUrl(`${BASE}/meal-plan/${actualEntryId}/complete`), {
        method: completed ? "DELETE" : "POST",
      });
    },
    onMutate: async ({ entryId, mealId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["meal-plan", date, activeClient?.id] });
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meal-plan", date, activeClient?.id] }),
  });

  // ── Toggle individual portion ─────────────────────────────────────────────

  const portionMutation = useMutation({
    mutationFn: async ({ mealId, portionId, completed }: { entryId: number; mealId: number; portionId: number; completed: boolean }) => {
      if (completed) {
        return customFetch(buildUrl(`${BASE}/meal-plan/${mealId}/portions/${portionId}/complete?date=${date}`), { method: "DELETE" });
      }
      return customFetch<{ meal_completed?: boolean }>(buildUrl(`${BASE}/meal-plan/${mealId}/portions/${portionId}/complete`), {
        method: "POST",
        body: JSON.stringify({ date }),
      });
    },
    onMutate: async ({ entryId, mealId, portionId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["meal-plan", date, activeClient?.id] });
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meal-plan", date, activeClient?.id] }),
  });

  // ── Day-only overrides (quantity / swap / remove / add — master plan untouched)
  const [picker, setPicker] = useState<{ mealId: number; portionId: number | null } | null>(null);
  const invalidateDay = () => {
    queryClient.invalidateQueries({ queryKey: ["meal-plan", date, activeClient?.id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-today"] });
  };
  const overrideMutation = useMutation({
    mutationFn: ({ mealId, portionId, body }: { mealId: number; portionId: number; body: Record<string, unknown> }) =>
      customFetch(buildUrl(`${BASE}/meal-plan/${date}/meals/${mealId}/portions/${portionId}/override`), {
        method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
      }),
    onSettled: invalidateDay,
  });
  const addExtraMutation = useMutation({
    mutationFn: ({ mealId, food, quantity }: { mealId: number; food: PickedFood; quantity: number }) =>
      customFetch(buildUrl(`${BASE}/meal-plan/${date}/meals/${mealId}/extras`), {
        method: "POST",
        body: JSON.stringify({ food_id: food.id, food_source: food.source, quantity_g: quantity }),
        headers: { "Content-Type": "application/json" },
      }),
    onSettled: invalidateDay,
  });
  const toggleExtraMutation = useMutation({
    mutationFn: (id: number) => customFetch(buildUrl(`${BASE}/meal-plan/extras/${id}/toggle`), { method: "POST" }),
    onSettled: invalidateDay,
  });
  const deleteExtraMutation = useMutation({
    mutationFn: (id: number) => customFetch(buildUrl(`${BASE}/meal-plan/extras/${id}`), { method: "DELETE" }),
    onSettled: invalidateDay,
  });
  const resetMealMutation = useMutation({
    mutationFn: (mealId: number) => customFetch(buildUrl(`${BASE}/meal-plan/${date}/meals/${mealId}/overrides`), { method: "DELETE" }),
    onSettled: invalidateDay,
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
      {/* Coach viewing banner */}
      {activeClient && (
        <div className="sticky top-0 z-30 bg-blue-600/90 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">Viewing: {activeClient.name}</span>
          </div>
          <button
            onClick={() => { 
              const backPath = activeClient.mode === "admin" ? "/admin" : "/coach/clients";
              setActiveClient(null); 
              setLocation(backPath);
            }}
            className="flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </div>
      )}
      {/* FLAppHeader */}
      <header
        className="px-5 pt-12 pb-5 relative sticky bg-background/80 backdrop-blur-xl z-20 border-b border-[rgba(255,255,255,0.04)]"
        style={{ top: activeClient ? "44px" : "0" }}
      >
        {/* Ambient teal glow */}
        <div
          className="absolute inset-x-0 top-0 h-40 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top, rgba(45,212,191,0.12), transparent 60%)" }}
        />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <button className="w-9 h-9 flex items-center justify-center rounded-full border border-[rgba(240,246,255,0.06)] hover:bg-muted transition-colors mt-0.5 shrink-0">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">Nutrition</p>
              <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-tight text-foreground">
                {t("mealPlan.title")}
              </h1>
            </div>
          </div>
          {date !== today && (
            <button
              onClick={() => setDate(today)}
              className="text-xs text-primary border border-primary/30 rounded-full px-3 py-1.5 hover:bg-primary/10 transition-colors mt-1"
            >
              Today
            </button>
          )}
        </div>
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
      <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.04)] space-y-3">
        {/* MiniStatPill row */}
        <div className="flex gap-2">
          {/* Planned */}
          <div className="flex-1 rounded-2xl px-3 py-3 text-center bg-[rgba(255,255,255,0.03)] border border-[rgba(240,246,255,0.06)]">
            <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1">Planned</p>
            <p className="text-[18px] font-bold tabular-nums leading-none text-primary">
              {Math.round(dailyTotals.calories)}<span className="text-[10px] font-medium ml-0.5 text-muted-foreground">kcal</span>
            </p>
          </div>
          {/* Consumed */}
          <div className="flex-1 rounded-2xl px-3 py-3 text-center bg-[rgba(255,255,255,0.03)] border border-[rgba(240,246,255,0.06)]">
            <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1">Consumed</p>
            <p className="text-[18px] font-bold tabular-nums leading-none text-foreground">
              {Math.round(consumedTotals.calories)}<span className="text-[10px] font-medium ml-0.5 text-muted-foreground">kcal</span>
            </p>
          </div>
          {/* Remaining */}
          <div className="flex-1 rounded-2xl px-3 py-3 text-center bg-[rgba(255,255,255,0.03)] border border-[rgba(240,246,255,0.06)]">
            <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1">Left</p>
            <p className="text-[18px] font-bold tabular-nums leading-none text-foreground">
              {Math.round(Math.max(0, dailyTotals.calories - consumedTotals.calories))}<span className="text-[10px] font-medium ml-0.5 text-muted-foreground">kcal</span>
            </p>
          </div>
        </div>

        {/* MacroBar grid vs target */}
        {plan && (
          <div className="space-y-2.5">
            {/* Calories — measured against the menu the user built */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Calories</span>
                <span className="text-[11px] font-semibold tabular-nums">
                  <span className="text-[#2DD4BF]">{Math.round(consumedTotals.calories)}</span>
                  <span className="text-muted-foreground"> / {Math.round(dailyTotals.calories)} kcal</span>
                </span>
              </div>
              <div className="h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                <div className="h-full bg-[#2DD4BF] rounded-full transition-all duration-500" style={{ width: `${Math.min((consumedTotals.calories / Math.max(1, dailyTotals.calories)) * 100, 100)}%` }} />
              </div>
              {/* Baseline target reference */}
              <p className="text-[10px] text-muted-foreground mt-1 text-right">
                Target {plan.calorieTarget} kcal
                {dailyTotals.calories > 0 && Math.round(dailyTotals.calories - plan.calorieTarget) !== 0 && (
                  <span className={Math.round(dailyTotals.calories - plan.calorieTarget) > 50 ? "text-amber-400" : "text-[#3B82F6]"}>
                    {" "}· menu {Math.round(dailyTotals.calories - plan.calorieTarget) > 0 ? "+" : ""}{Math.round(dailyTotals.calories - plan.calorieTarget)}
                  </span>
                )}
              </p>
            </div>

            {/* Protein */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Protein</span>
                <span className="text-[11px] font-semibold tabular-nums">
                  <span className="text-[#3B82F6]">{Math.round(consumedTotals.protein_g)}</span>
                  <span className="text-muted-foreground"> / {Math.round(dailyTotals.protein_g)}g</span>
                </span>
              </div>
              <div className="h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-500" style={{ width: `${Math.min((consumedTotals.protein_g / Math.max(1, dailyTotals.protein_g)) * 100, 100)}%` }} />
              </div>
            </div>

            {/* Carbs */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Carbs</span>
                <span className="text-[11px] font-semibold tabular-nums">
                  <span className="text-[#F59E0B]">{Math.round(consumedTotals.carbs_g)}</span>
                  <span className="text-muted-foreground"> / {Math.round(dailyTotals.carbs_g)}g</span>
                </span>
              </div>
              <div className="h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                <div className="h-full bg-[#F59E0B] rounded-full transition-all duration-500" style={{ width: `${Math.min((consumedTotals.carbs_g / Math.max(1, dailyTotals.carbs_g)) * 100, 100)}%` }} />
              </div>
            </div>

            {/* Fat */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Fat</span>
                <span className="text-[11px] font-semibold tabular-nums">
                  <span className="text-[#EAB308]">{Math.round(consumedTotals.fat_g)}</span>
                  <span className="text-muted-foreground"> / {Math.round(dailyTotals.fat_g)}g</span>
                </span>
              </div>
              <div className="h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                <div className="h-full bg-[#EAB308] rounded-full transition-all duration-500" style={{ width: `${Math.min((consumedTotals.fat_g / Math.max(1, dailyTotals.fat_g)) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Meals completion progress */}
        {entries.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Meals</span>
              <span className="text-[11px] font-semibold text-foreground">{completedCount} / {entries.length}</span>
            </div>
            <div className="h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
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
            <div className="w-16 h-16 rounded-full bg-[#0F1F3D] flex items-center justify-center">
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
            onOverrideQty={(portionId, quantity) => entry.meal && overrideMutation.mutate({ mealId: entry.meal.id, portionId, body: { quantity_g: quantity } })}
            onRemoveToday={(portionId) => entry.meal && overrideMutation.mutate({ mealId: entry.meal.id, portionId, body: { removed: true } })}
            onSwapRequest={(portionId) => entry.meal && setPicker({ mealId: entry.meal.id, portionId })}
            onAddFoodRequest={() => entry.meal && setPicker({ mealId: entry.meal.id, portionId: null })}
            onToggleExtra={(extraId) => toggleExtraMutation.mutate(extraId)}
            onDeleteExtra={(extraId) => deleteExtraMutation.mutate(extraId)}
            onResetMeal={() => entry.meal && resetMealMutation.mutate(entry.meal.id)}
          />
        ))}
      </div>

      {/* Day-only food picker (swap / add) */}
      {picker && (
        <FoodPickerSheet
          title={picker.portionId !== null ? "Swap food" : "Add food"}
          onClose={() => setPicker(null)}
          onConfirm={(food, quantity) => {
            if (picker.portionId !== null) {
              overrideMutation.mutate({ mealId: picker.mealId, portionId: picker.portionId, body: { food_id: food.id, food_source: food.source, quantity_g: quantity } });
            } else {
              addExtraMutation.mutate({ mealId: picker.mealId, food, quantity });
            }
            setPicker(null);
          }}
        />
      )}

      {/* Add Meal FAB */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30" style={{ width: "calc(min(672px, 100vw) - 40px)" }}>
        <Button onClick={() => setShowSheet(true)} size="lg" className="w-full justify-center gap-2">
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
