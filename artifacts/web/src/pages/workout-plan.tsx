import { useState, useMemo } from "react";
import { useLanguage } from "@/context/language-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2,
  Circle, Loader2, Dumbbell, Flame, CalendarDays, X, ArrowLeft, UserCheck,
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
  completed: boolean;
  workout: PlanWorkout;
}

interface DayWorkoutPlan {
  date: string;
  day_of_week: string;
  entries: PlanEntry[];
  total_calories: number;
  burned_calories: number;
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
    <Card className={`bg-[#1A1A1A] border-border/40 overflow-hidden transition-all ${entry.completed ? "opacity-70" : ""}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button onClick={onToggleComplete} className="shrink-0 text-muted-foreground hover:text-primary transition-colors" aria-label={entry.completed ? "Mark incomplete" : "Mark complete"}>
          {entry.completed ? <CheckCircle2 className="w-6 h-6 text-primary" /> : <Circle className="w-6 h-6" />}
        </button>

        <button onClick={() => setExpanded(v => !v)} className="flex-1 text-left min-w-0">
          <p className={`font-semibold text-sm break-words ${entry.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {workout.workout_name}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{Math.round(workout.total_calories)} kcal</span>
            <span>·</span>
            <span>{workout.exercises.length} exercise{workout.exercises.length !== 1 ? "s" : ""}</span>
            {total > 0 && <span>· {completedCount}/{total} done</span>}
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
            const imgUrl = getExerciseImageUrl(ex.exercise_name);
            return (
              <div key={ex.id} className={`flex items-center gap-3 py-2.5 ${ex.completed ? "opacity-50" : ""}`}>
                <button onClick={() => onToggleExercise(ex.id)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                  {ex.completed ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Circle className="w-5 h-5" />}
                </button>
                {imgUrl && (
                  <button onClick={() => onViewImage?.(imgUrl)} className="shrink-0 w-10 h-10 rounded overflow-hidden hover:opacity-80 transition-opacity">
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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ maxWidth: 430, margin: "0 auto" }}>
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="bg-[#111111] border-t border-border/40 rounded-t-2xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/30">
          <h3 className="font-semibold text-sm">Add workout to {formatDisplay(date)}</h3>
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
                className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${alreadyAdded ? "bg-[#1A1A1A] border-border/20 opacity-40 cursor-not-allowed" : "bg-[#1A1A1A] border-border/40 hover:border-primary/40 active:scale-[0.99]"}`}
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
      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between sticky bg-background/90 backdrop-blur-xl z-20 border-b border-border/40" style={{ top: activeClient ? "44px" : "0" }}>
        <Link href="/dashboard">
          <button className="w-9 h-9 flex items-center justify-center rounded-full border border-border/40 hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h1 className="text-base font-semibold">{t("workoutPlan.title")}</h1>
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
      <div className="px-5 py-4 border-b border-border/20 space-y-3">
        {/* Calorie pills */}
        <div className="flex gap-2">
          {/* Planned */}
          <div className="flex-1 rounded-xl px-2 py-2.5 text-center bg-primary/15 border border-primary/30">
            <div className="text-base font-bold tabular-nums text-primary">
              {Math.round(totalCalories)}<span className="text-[10px] font-medium ml-0.5">kcal</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Planned</div>
          </div>
          {/* Burned */}
          <div className="flex-1 rounded-xl px-2 py-2.5 text-center bg-[#1A1A1A]">
            <div className="text-base font-bold tabular-nums text-foreground">
              {Math.round(burnedCalories)}<span className="text-[10px] font-medium ml-0.5">kcal</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Burned</div>
          </div>
          {/* Remaining */}
          <div className="flex-1 rounded-xl px-2 py-2.5 text-center bg-[#1A1A1A]">
            <div className="text-base font-bold tabular-nums text-foreground">
              {Math.round(Math.max(0, totalCalories - burnedCalories))}<span className="text-[10px] font-medium ml-0.5">kcal</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Remaining</div>
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
            <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
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
            <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${entries.length > 0 ? (completedCount / entries.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Workout list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-28">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[#1A1A1A] flex items-center justify-center">
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
      </div>

      {/* Add Workout FAB */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30" style={{ width: "calc(min(430px, 100vw) - 40px)" }}>
        <Button
          onClick={() => setShowSheet(true)}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-sm gap-2"
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
