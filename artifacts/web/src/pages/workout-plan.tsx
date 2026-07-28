import { useState, useMemo } from "react";
import { useLanguage } from "@/context/language-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2,
  Circle, Loader2, Dumbbell, Flame, CalendarDays, X, ArrowLeft, UserCheck, RotateCcw,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getExerciseImageUrl } from "@/lib/exercise-images";
import BottomNav from "@/components/bottom-nav";
import { useCoachClient, useClientUrl } from "@/context/coach-client-context";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

// ── Date helpers ──────────────────────────────────────────────────────────────

function getTodayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplay(dateStr: string) {
  const today = getTodayLocal();
  if (dateStr === offsetDate(today, -1)) return "Yesterday";
  if (dateStr === today) return "Today";
  if (dateStr === offsetDate(today, 1)) return "Tomorrow";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function offsetDate(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanExercise {
  id: number;
  workout_id: number;
  exercise_name: string;
  image_url?: string | null;
  muscle_primary: string;
  exercise_type: "strength" | "cardio";
  equipment: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  weight_kg: number | null;
  rest_seconds: number;
  duration_mins: number | null;
  effort_level: string | null;
  order_index: number;
  notes: string | null;
  estimated_calories: number;
  duration_mins_computed: number;
  completed: boolean;
}

interface PlanWorkout {
  id: number;
  workout_name: string;
  exercises: PlanExercise[];
  total_calories: number;
}

interface PlanEntry {
  entry_id: number;
  is_entry: boolean;
  source?: "scheduled" | "cycle";
  cycle_program_name?: string;
  cycle_position?: number;
  cycle_slot_label?: string | null;
  completed: boolean;
  workout: PlanWorkout;
}

/** An exercise added for this date only — plan and cycle untouched. */
interface DayExtra {
  id: number;
  exercise_id: number;
  exercise_name: string;
  image_url?: string | null;
  muscle_primary: string;
  exercise_type: "strength" | "cardio";
  equipment: string;
  sets: number; reps_min: number; reps_max: number; rest_seconds: number;
  duration_mins: number | null;
  completed: boolean;
  estimated_calories: number;
}

interface DayWorkoutPlan {
  date: string;
  day_of_week: string;
  entries: PlanEntry[];
  extras?: DayExtra[];
  total_calories: number;
  burned_calories: number;
  /** True when a calendar_based cycle programme marks this day as a rest day. */
  is_calendar_rest_day?: boolean;
}

interface LibraryExercise {
  id: number; exercise_name: string; muscle_primary: string;
  exercise_type: "strength" | "cardio"; equipment: string;
  image_url?: string | null;
}

interface LibraryWorkout {
  id: number;
  workout_name: string;
  total_calories: number;
  scheduled_days: string[];
}

const EQUIPMENT_ICONS: Record<string, string> = {
  barbell: "[B]", dumbbell: "[D]", machine: "[M]", cable: "[C]", bodyweight: "[BW]",
};

// ── Calendar picker ───────────────────────────────────────────────────────────

function CalendarPicker({ selectedDate, onSelectDate, onClose }: {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onClose: () => void;
}) {
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
          <button onClick={() => { const p = new Date(year, month-2,1); setCalendarDate(`${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,"0")}-01`); }} className="p-2 hover:bg-muted rounded-lg">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-sm">{monthName}</h3>
          <button onClick={() => { const n = new Date(year, month, 1); setCalendarDate(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`); }} className="p-2 hover:bg-muted rounded-lg">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pt-3 pb-1 grid grid-cols-7 gap-1 text-[10px] font-medium text-muted-foreground uppercase">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => (
            <div key={day} className="text-center py-1">{day}</div>
          ))}
        </div>
        <div className="px-5 pb-4 grid grid-cols-7 gap-1">
          {days.map((dayNum, idx) => {
            const isSelected = dayNum && `${year}-${String(month).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}` === selectedDate;
            return (
              <button key={idx} onClick={() => { if (!dayNum) return; const nd = `${year}-${String(month).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`; onSelectDate(nd); onClose(); }} disabled={!dayNum}
                className={`aspect-square rounded-lg text-sm font-medium transition-colors ${!dayNum ? "text-muted-foreground/20 cursor-default" : isSelected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
              >
                {dayNum}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Workout card ──────────────────────────────────────────────────────────────

function WorkoutCard({ entry, onRemove, onToggleComplete, onToggleExercise, onViewImage }: {
  entry: PlanEntry;
  onRemove: () => void;
  onToggleComplete: () => void;
  onToggleExercise: (weId: number) => void;
  onViewImage?: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const workout = entry.workout;
  const completedCount = workout.exercises.filter(e => e.completed).length;
  const total = workout.exercises.length;

  return (
    <Card className={`bg-[#0F1F3D] border-[rgba(240,246,255,0.06)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.4)] overflow-hidden transition-all ${entry.completed ? "opacity-60" : ""}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button onClick={onToggleComplete} className="shrink-0 text-muted-foreground hover:text-primary transition-colors" aria-label={entry.completed ? "Mark incomplete" : "Mark complete"}>
          {entry.completed ? <CheckCircle2 className="w-6 h-6 text-primary" /> : <Circle className="w-6 h-6" />}
        </button>

        <button onClick={() => setExpanded(v => !v)} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`font-semibold text-sm break-words ${entry.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {workout.workout_name}
            </p>
            {entry.source === "cycle" && (
              <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-400 border border-violet-500/30">
                <RotateCcw className="w-2.5 h-2.5" />Cycle
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{Math.round(workout.total_calories)} kcal</span>
            <span>·</span>
            <span>{workout.exercises.length} exercise{workout.exercises.length !== 1 ? "s" : ""}</span>
            {total > 0 && <span>· {completedCount}/{total} done</span>}
            {entry.source === "cycle" && entry.cycle_program_name && (
              <><span>·</span><span className="text-violet-400">{entry.cycle_program_name} · Day {(entry.cycle_position ?? 0) + 1}</span></>
            )}
          </div>
        </button>

        <button onClick={onRemove} className="shrink-0 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" aria-label="Remove workout">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="px-4 pb-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(completedCount / total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Exercises (collapsible) */}
      {expanded && workout.exercises.length > 0 && (
        <div className="border-t border-border/30 px-4 divide-y divide-border/20">
          {workout.exercises.map(ex => {
            const isCardio = ex.exercise_type === "cardio";
            const equip = EQUIPMENT_ICONS[ex.equipment] ?? "";
            const imgUrl = ex.image_url || getExerciseImageUrl(ex.exercise_name);
            return (
              <div key={ex.id} className={`flex items-center gap-3 py-2.5 ${ex.completed ? "opacity-50" : ""}`}>
                <button onClick={() => onToggleExercise(ex.id)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                  {ex.completed ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Circle className="w-5 h-5" />}
                </button>
                {imgUrl && (
                  <button
                    onClick={() => onViewImage?.(imgUrl)}
                    className="shrink-0 overflow-hidden hover:opacity-80 transition-opacity border border-[rgba(240,246,255,0.06)]"
                    style={{ width: 52, height: 52, borderRadius: 20 }}
                  >
                    <img src={imgUrl} alt={ex.exercise_name} className="w-full h-full object-cover" />
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-sm font-medium ${ex.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{ex.exercise_name}</span>
                    {equip && <span className="text-[10px] text-muted-foreground/60 font-mono">{equip}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isCardio
                      ? `${ex.duration_mins ?? "—"} min · ${Math.round(ex.estimated_calories)} kcal`
                      : `${ex.sets} × ${ex.reps_min}–${ex.reps_max} reps${ex.weight_kg ? ` · ${ex.weight_kg}kg` : ""} · ${Math.round(ex.estimated_calories)} kcal`}
                  </p>
                  {ex.notes && <p className="text-[10px] text-muted-foreground/60 italic mt-0.5">{ex.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expanded && workout.exercises.length === 0 && (
        <div className="border-t border-border/30 px-4 py-3 text-xs text-muted-foreground">No exercises added yet.</div>
      )}

      {/* Tap to expand hint */}
      {!expanded && workout.exercises.length > 0 && (
        <button onClick={() => setExpanded(true)} className="w-full text-center text-[10px] text-muted-foreground/50 pb-2 hover:text-muted-foreground transition-colors">
          {workout.exercises.length} exercise{workout.exercises.length !== 1 ? "s" : ""} · tap to view
        </button>
      )}

      {/* Mark all complete button when expanded */}
      {expanded && total > 0 && !entry.completed && (
        <div className="px-4 pb-3 pt-1">
          <button onClick={onToggleComplete} className={`w-full text-center rounded-xl py-2.5 text-xs font-semibold transition-all border ${completedCount === total ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border/30"}`}>
            {completedCount === total ? "Mark Workout Complete" : `Mark Complete (${total - completedCount} remaining)`}
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Add Exercise (day only) Sheet ─────────────────────────────────────────────

function AddExerciseSheet({ onClose, onAdd, isAdding }: {
  onClose: () => void;
  onAdd: (body: Record<string, unknown>) => void;
  isAdding: boolean;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<LibraryExercise | null>(null);
  const [sets, setSets] = useState("4");
  const [repsMin, setRepsMin] = useState("12");
  const [repsMax, setRepsMax] = useState("15");
  const [rest, setRest] = useState("60");
  const [mins, setMins] = useState("20");
  const buildUrl = useClientUrl();

  const { data: exercises = [], isLoading } = useQuery<LibraryExercise[]>({
    queryKey: ["exercises", q],
    queryFn: () => customFetch<LibraryExercise[]>(buildUrl(`${BASE}/exercises?q=${encodeURIComponent(q)}`)),
  });
  const shown = exercises.slice(0, 40);
  const isCardio = picked?.exercise_type === "cardio";

  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-[#0F1F3D] border-t border-border/50 rounded-t-3xl p-5 pb-8 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-foreground">
            {picked ? picked.exercise_name : "Add exercise"} <span className="text-[10px] font-medium text-amber-400">· today only</span>
          </p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {!picked ? (
          <>
            <input
              autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search exercises..."
              className="w-full rounded-xl bg-[#1B3260]/50 border border-border/40 text-sm text-foreground px-3.5 py-2.5 mb-3 focus:outline-none focus:border-primary/50"
            />
            <div className="overflow-y-auto flex-1 space-y-1.5">
              {isLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>}
              {!isLoading && shown.map(ex => (
                <button key={ex.id}
                  onClick={() => { setPicked(ex); }}
                  className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl bg-[#1B3260]/40 border border-border/30 hover:border-primary/40">
                  <div className="w-9 h-9 rounded-lg bg-[#1B3260] overflow-hidden shrink-0 flex items-center justify-center">
                    {ex.image_url ? <img src={ex.image_url} alt="" className="w-full h-full object-cover" /> : <Dumbbell className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{ex.exercise_name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{ex.muscle_primary} · {ex.equipment}</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${ex.exercise_type === "cardio" ? "bg-blue-500/15 text-blue-400" : "bg-primary/10 text-primary"}`}>
                    {ex.exercise_type}
                  </span>
                </button>
              ))}
              {!isLoading && shown.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No exercises found</p>}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {isCardio ? (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration (minutes)</label>
                <input autoFocus type="number" min="1" value={mins} onChange={e => setMins(e.target.value)}
                  className="w-full mt-1 rounded-xl bg-[#1B3260]/50 border border-border/40 text-sm text-foreground px-3 py-2.5 focus:outline-none focus:border-primary/50" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Sets", v: sets, set: setSets },
                  { label: "Rest (sec)", v: rest, set: setRest },
                  { label: "Reps min", v: repsMin, set: setRepsMin },
                  { label: "Reps max", v: repsMax, set: setRepsMax },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</label>
                    <input type="number" min="1" value={f.v} onChange={e => f.set(e.target.value)}
                      className="w-full mt-1 rounded-xl bg-[#1B3260]/50 border border-border/40 text-sm text-foreground px-3 py-2 focus:outline-none focus:border-primary/50" />
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setPicked(null)} className="flex-1 rounded-xl py-2.5 text-xs font-semibold bg-muted text-muted-foreground">Back</button>
              <button
                disabled={isAdding}
                onClick={() => onAdd(isCardio
                  ? { exercise_id: picked.id, duration_mins: Number(mins) }
                  : { exercise_id: picked.id, sets: Number(sets), reps_min: Number(repsMin), reps_max: Number(repsMax), rest_seconds: Number(rest) })}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold bg-primary text-[#081025] disabled:opacity-60">
                {isAdding ? "Adding..." : "Add to today"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Workout Sheet ─────────────────────────────────────────────────────────

function AddWorkoutSheet({ date, existingWorkoutIds, onClose, onAdd, isAdding }: {
  date: string;
  existingWorkoutIds: Set<number>;
  onClose: () => void;
  onAdd: (workoutId: number) => void;
  isAdding: boolean;
}) {
  const { data: workouts = [], isLoading } = useQuery<LibraryWorkout[]>({
    queryKey: ["workouts"],
    queryFn: () => customFetch<LibraryWorkout[]>(`${BASE}/workouts`),
    staleTime: 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ maxWidth: 672, margin: "0 auto" }}>
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="bg-[#111111] border-t border-border/40 rounded-t-2xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/30">
          <h3 className="font-semibold text-sm">Add workout to {formatDisplay(date)}</h3>
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

          {!isLoading && !isAdding && workouts.length === 0 && (
            <div className="text-center py-10 space-y-2">
              <Dumbbell className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No workouts yet</p>
              <Link href="/training/builder" onClick={onClose}>
                <span className="text-xs text-primary underline underline-offset-2">Create workouts in the Exercise Builder</span>
              </Link>
            </div>
          )}

          {!isLoading && !isAdding && workouts.map(workout => {
            const alreadyAdded = existingWorkoutIds.has(workout.id);
            return (
              <button
                key={workout.id}
                onClick={() => !alreadyAdded && !isAdding && onAdd(workout.id)}
                disabled={alreadyAdded || isAdding}
                className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${alreadyAdded ? "bg-[#0F1F3D] border-border/20 opacity-40 cursor-not-allowed" : "bg-[#0F1F3D] border-border/40 hover:border-primary/40 active:scale-[0.99]"}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="font-semibold text-sm text-foreground">{workout.workout_name}</p>
                  {alreadyAdded && <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">Added</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{Math.round(workout.total_calories)} kcal</span>
                  {workout.scheduled_days.length > 0 && (
                    <><span>·</span><span>{workout.scheduled_days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ")}</span></>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkoutPlan() {
  const { t } = useLanguage();
  const [date, setDate] = useState(getTodayLocal());
  const [showSheet, setShowSheet] = useState(false);
  const [showExerciseSheet, setShowExerciseSheet] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [imageModal, setImageModal] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { activeClient, setActiveClient } = useCoachClient();
  const buildUrl = useClientUrl();
  const [, setLocation] = useLocation();
  const today = getTodayLocal();

  const { data: dayPlan, isLoading } = useQuery<DayWorkoutPlan>({
    queryKey: ["workout-plan", date, activeClient?.id],
    queryFn: () => customFetch<DayWorkoutPlan>(buildUrl(`${BASE}/workout-plan?date=${date}`)),
    staleTime: 0,
    refetchOnMount: "always",
  });

  // ── Day-only extra exercises ───────────────────────────────────────────────
  const invalidateDay = () => {
    queryClient.invalidateQueries({ queryKey: ["workout-plan", date, activeClient?.id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-today"] });
  };
  const addExtraMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      customFetch(buildUrl(`${BASE}/workout-plan/${date}/extras`), {
        method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => setShowExerciseSheet(false),
    onSettled: invalidateDay,
  });
  const toggleExtraMutation = useMutation({
    mutationFn: (id: number) => customFetch(buildUrl(`${BASE}/workout-plan/extras/${id}/toggle`), { method: "POST" }),
    onSettled: invalidateDay,
  });
  const deleteExtraMutation = useMutation({
    mutationFn: (id: number) => customFetch(buildUrl(`${BASE}/workout-plan/extras/${id}`), { method: "DELETE" }),
    onSettled: invalidateDay,
  });

  // Add workout to date
  const addMutation = useMutation({
    mutationFn: (workoutId: number) =>
      customFetch(buildUrl(`${BASE}/workout-plan`), {
        method: "POST",
        body: JSON.stringify({ date, workout_id: workoutId }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-plan", date, activeClient?.id] });
      setShowSheet(false);
    },
    onError: (error) => {
      console.error("Failed to add workout:", error);
    },
  });

  // Remove workout from date
  const removeMutation = useMutation({
    mutationFn: async ({ entryId, workoutId, isEntry }: { entryId: number; workoutId: number; isEntry: boolean }) => {
      if (!isEntry) {
        // Scheduled workout: exclude from schedule with query params
        return customFetch(buildUrl(`${BASE}/workout-plan/0?workout_id=${workoutId}&date=${date}`), { method: "DELETE" });
      }
      return customFetch(buildUrl(`${BASE}/workout-plan/${entryId}`), { method: "DELETE" });
    },
    onMutate: async ({ workoutId }) => {
      await queryClient.cancelQueries({ queryKey: ["workout-plan", date, activeClient?.id] });
      const prev = queryClient.getQueryData<DayWorkoutPlan>(["workout-plan", date]);
      if (prev) {
        queryClient.setQueryData<DayWorkoutPlan>(["workout-plan", date], {
          ...prev,
          entries: prev.entries.filter(e => e.workout.id !== workoutId),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["workout-plan", date], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["workout-plan", date, activeClient?.id] }),
  });

  // Toggle workout complete/incomplete
  const workoutCompleteMutation = useMutation({
    mutationFn: async ({ workoutId, completed }: { workoutId: number; completed: boolean }) => {
      if (completed) {
        return customFetch(buildUrl(`${BASE}/workout-plan/${workoutId}/complete?date=${date}`), { method: "DELETE" });
      }
      return customFetch(buildUrl(`${BASE}/workout-plan/${workoutId}/complete`), {
        method: "POST",
        body: JSON.stringify({ date }),
      });
    },
    onMutate: async ({ workoutId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["workout-plan", date, activeClient?.id] });
      const prev = queryClient.getQueryData<DayWorkoutPlan>(["workout-plan", date]);
      if (prev) {
        queryClient.setQueryData<DayWorkoutPlan>(["workout-plan", date], {
          ...prev,
          entries: prev.entries.map(e =>
            e.workout.id === workoutId
              ? {
                  ...e,
                  completed: !completed,
                  workout: {
                    ...e.workout,
                    exercises: e.workout.exercises.map(ex => ({ ...ex, completed: !completed })),
                  },
                }
              : e
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["workout-plan", date], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["workout-plan", date, activeClient?.id] }),
  });

  // Toggle exercise complete/incomplete
  const exerciseCompleteMutation = useMutation({
    mutationFn: async ({ workoutId, weId, completed }: { workoutId: number; weId: number; completed: boolean }) => {
      if (completed) {
        return customFetch(buildUrl(`${BASE}/workout-plan/${workoutId}/exercises/${weId}/complete?date=${date}`), { method: "DELETE" });
      }
      return customFetch<{ workout_completed?: boolean }>(buildUrl(`${BASE}/workout-plan/${workoutId}/exercises/${weId}/complete`), {
        method: "POST",
        body: JSON.stringify({ date }),
      });
    },
    onMutate: async ({ workoutId, weId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["workout-plan", date, activeClient?.id] });
      const prev = queryClient.getQueryData<DayWorkoutPlan>(["workout-plan", date]);
      if (prev) {
        queryClient.setQueryData<DayWorkoutPlan>(["workout-plan", date], {
          ...prev,
          entries: prev.entries.map(e => {
            if (e.workout.id !== workoutId) return e;
            const updatedExercises = e.workout.exercises.map(ex =>
              ex.id === weId ? { ...ex, completed: !completed } : ex
            );
            const allDone = updatedExercises.length > 0 && updatedExercises.every(ex => ex.completed);
            return {
              ...e,
              completed: !completed ? (allDone ? true : e.completed) : false,
              workout: { ...e.workout, exercises: updatedExercises },
            };
          }),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["workout-plan", date], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["workout-plan", date, activeClient?.id] }),
  });

  const entries = dayPlan?.entries ?? [];
  const totalCalories = dayPlan?.total_calories ?? 0;
  const burnedCalories = dayPlan?.burned_calories ?? 0;
  const isCalendarRestDay = dayPlan?.is_calendar_rest_day ?? false;
  const completedCount = entries.filter(e => e.completed).length;
  const existingWorkoutIds = useMemo(() => new Set(entries.map(e => e.workout.id)), [entries]);

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
              <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">Training</p>
              <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-tight text-foreground">
                {t("workoutPlan.title")}
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
        <button
          onClick={() => setDate(offsetDate(date, -1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={() => setShowCalendar(true)} className="text-center hover:opacity-70 transition-opacity flex-1">
          <p className="font-semibold text-base">{formatDisplay(date)}</p>
          <p className="text-xs text-muted-foreground">{formatFullDate(date)}</p>
        </button>
        <button
          onClick={() => setDate(offsetDate(date, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Summary section */}
      <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.04)] space-y-3">
        {/* MiniStatPill row */}
        <div className="flex gap-2">
          {/* Planned */}
          <div className="flex-1 rounded-2xl px-3 py-3 text-center bg-[rgba(255,255,255,0.03)] border border-[rgba(240,246,255,0.06)]">
            <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1">Planned</p>
            <p className="text-[18px] font-bold tabular-nums leading-none text-primary">
              {Math.round(totalCalories)}<span className="text-[10px] font-medium ml-0.5 text-muted-foreground">kcal</span>
            </p>
          </div>
          {/* Burned */}
          <div className="flex-1 rounded-2xl px-3 py-3 text-center bg-[rgba(255,255,255,0.03)] border border-[rgba(240,246,255,0.06)]">
            <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1">Burned</p>
            <p className="text-[18px] font-bold tabular-nums leading-none text-foreground">
              {Math.round(burnedCalories)}<span className="text-[10px] font-medium ml-0.5 text-muted-foreground">kcal</span>
            </p>
          </div>
          {/* Remaining */}
          <div className="flex-1 rounded-2xl px-3 py-3 text-center bg-[rgba(255,255,255,0.03)] border border-[rgba(240,246,255,0.06)]">
            <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1">Left</p>
            <p className="text-[18px] font-bold tabular-nums leading-none text-foreground">
              {Math.round(Math.max(0, totalCalories - burnedCalories))}<span className="text-[10px] font-medium ml-0.5 text-muted-foreground">kcal</span>
            </p>
          </div>
        </div>

        {/* Calories progress */}
        {totalCalories > 0 && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Calories</span>
              <span className="text-xs font-semibold text-foreground">
                {Math.round(burnedCalories)} / {Math.round(totalCalories)} kcal
              </span>
            </div>
            <div className="h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F97316] rounded-full transition-all duration-500"
                style={{ width: `${Math.min((burnedCalories / totalCalories) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Workouts completion */}
        {entries.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Workouts</span>
              <span className="text-xs font-semibold text-foreground">
                {completedCount} / {entries.length}
              </span>
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

      {/* Workout list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-40">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && entries.length === 0 && isCalendarRestDay && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-blue-300">Scheduled Rest Day</p>
              <p className="text-xs text-muted-foreground mt-1">Your training cycle resumes tomorrow — enjoy the recovery!</p>
            </div>
          </div>
        )}

        {!isLoading && entries.length === 0 && !isCalendarRestDay && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[#0F1F3D] flex items-center justify-center">
              <Dumbbell className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">No workouts planned</p>
              <p className="text-xs text-muted-foreground mt-1">Add workouts from your library to plan this day</p>
            </div>
          </div>
        )}

        {entries.map(entry => (
          <WorkoutCard
            key={`${entry.is_entry ? "entry" : "sched"}-${entry.is_entry ? entry.entry_id : entry.workout.id}`}
            entry={entry}
            onRemove={() => removeMutation.mutate({ entryId: entry.entry_id, workoutId: entry.workout.id, isEntry: entry.is_entry })}
            onToggleComplete={() => workoutCompleteMutation.mutate({ workoutId: entry.workout.id, completed: entry.completed })}
            onToggleExercise={(weId) => {
              const ex = entry.workout.exercises.find(e => e.id === weId);
              if (ex) exerciseCompleteMutation.mutate({ workoutId: entry.workout.id, weId, completed: ex.completed });
            }}
            onViewImage={(url) => setImageModal(url)}
          />
        ))}

        {/* Extra exercises added for this day only */}
        {(dayPlan?.extras?.length ?? 0) > 0 && (
          <div className="rounded-2xl bg-[#0F1F3D] border border-primary/25 overflow-hidden">
            <div className="px-4 pt-3.5 pb-2 flex items-center gap-2">
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-primary">Extra today</p>
              <span className="text-[10px] text-muted-foreground">· not part of your plan</span>
            </div>
            <div className="px-4 pb-3 divide-y divide-border/20">
              {dayPlan!.extras!.map(x => (
                <div key={x.id} className={`flex items-center gap-3 py-2.5 ${x.completed ? "opacity-50" : ""}`}>
                  <button onClick={() => toggleExtraMutation.mutate(x.id)}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                    {x.completed ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Circle className="w-5 h-5" />}
                  </button>
                  {x.image_url && (
                    <button onClick={() => setImageModal(x.image_url!)}
                      className="shrink-0 overflow-hidden border border-[rgba(240,246,255,0.06)]"
                      style={{ width: 44, height: 44, borderRadius: 14 }}>
                      <img src={x.image_url} alt="" className="w-full h-full object-cover" />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${x.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {x.exercise_name}
                      <span className="ms-1.5 text-[9px] font-bold text-primary bg-primary/15 rounded px-1 py-0.5 align-middle">today</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {x.exercise_type === "cardio"
                        ? `${x.duration_mins} min`
                        : `${x.sets} × ${x.reps_min}–${x.reps_max} reps`}
                      {" · "}{Math.round(x.estimated_calories)} kcal
                    </p>
                  </div>
                  <button onClick={() => deleteExtraMutation.mutate(x.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors" aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add a single exercise for today only */}
        <button onClick={() => setShowExerciseSheet(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-dashed border-border/60 text-[11px] font-semibold text-primary hover:border-primary/40 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add exercise · today only
        </button>
      </div>

      {/* Add Workout FAB */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30" style={{ width: "calc(min(672px, 100vw) - 40px)" }}>
        <Button
          onClick={() => setShowSheet(true)}
          size="lg"
          className="w-full justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Workout
        </Button>
      </div>

      {/* Add Workout Sheet */}
      {showSheet && (
        <AddWorkoutSheet
          date={date}
          existingWorkoutIds={existingWorkoutIds}
          onClose={() => setShowSheet(false)}
          onAdd={(workoutId) => addMutation.mutate(workoutId)}
          isAdding={addMutation.isPending}
        />
      )}

      {/* Add single exercise (day only) */}
      {showExerciseSheet && (
        <AddExerciseSheet
          onClose={() => setShowExerciseSheet(false)}
          onAdd={(body) => addExtraMutation.mutate(body)}
          isAdding={addExtraMutation.isPending}
        />
      )}

      {showCalendar && (
        <CalendarPicker
          selectedDate={date}
          onSelectDate={setDate}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Image modal */}
      {imageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setImageModal(null)}>
          <div className="relative max-w-md w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setImageModal(null)} className="absolute top-2 right-2 z-10 p-1 bg-black/60 rounded-lg hover:bg-black/80 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
            <img src={imageModal} alt="Exercise" className="w-full rounded-xl object-contain" />
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
