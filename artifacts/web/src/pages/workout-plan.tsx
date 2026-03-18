import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Loader2,
  Dumbbell, Flame, CalendarDays,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

// ── Date helpers ──────────────────────────────────────────────────────────────

function getTodayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateStr(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplay(dateStr: string) {
  const today = getTodayLocal();
  const yesterday = offsetDate(today, -1);
  const tomorrow = offsetDate(today, 1);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  if (dateStr === tomorrow) return "Tomorrow";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function offsetDate(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function formatDayOfWeek(day: string) {
  return day.charAt(0).toUpperCase() + day.slice(1);
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
  completed: boolean;
}

interface DayWorkoutPlan {
  date: string;
  day_of_week: string;
  workouts: PlanWorkout[];
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

  const handleDateClick = (dayNum: number) => {
    const newDate = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    onSelectDate(newDate);
    onClose();
  };

  const handlePrevMonth = () => {
    const prev = new Date(year, month - 2, 1);
    setCalendarDate(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`);
  };

  const handleNextMonth = () => {
    const next = new Date(year, month, 1);
    setCalendarDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ maxWidth: 430, margin: "0 auto" }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#111111] border-t border-border/40 rounded-t-2xl w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-muted rounded-lg">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-sm">{monthName}</h3>
          <button onClick={handleNextMonth} className="p-2 hover:bg-muted rounded-lg">
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
            const isSelected = dayNum &&
              `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` === selectedDate;
            return (
              <button
                key={idx}
                onClick={() => dayNum && handleDateClick(dayNum)}
                disabled={!dayNum}
                className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                  !dayNum
                    ? "text-muted-foreground/20 cursor-default"
                    : isSelected
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
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

// ── Exercise row ──────────────────────────────────────────────────────────────

function ExerciseRow({ exercise, onToggle }: {
  exercise: PlanExercise;
  onToggle: () => void;
}) {
  const equipIcon = EQUIPMENT_ICONS[exercise.equipment] ?? "";
  const isCardio = exercise.exercise_type === "cardio";

  return (
    <div className={`flex items-center gap-3 py-2.5 transition-opacity ${exercise.completed ? "opacity-50" : ""}`}>
      <button
        onClick={onToggle}
        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
        aria-label={exercise.completed ? "Mark incomplete" : "Mark complete"}
      >
        {exercise.completed
          ? <CheckCircle2 className="w-5 h-5 text-primary" />
          : <Circle className="w-5 h-5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-sm font-medium break-words ${exercise.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {exercise.exercise_name}
          </span>
          {equipIcon && (
            <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">{equipIcon}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isCardio
            ? `${exercise.duration_mins ?? "—"} min · ${Math.round(exercise.estimated_calories)} kcal`
            : `${exercise.sets} × ${exercise.reps_min}–${exercise.reps_max} reps${exercise.weight_kg ? ` · ${exercise.weight_kg}kg` : ""} · ${Math.round(exercise.estimated_calories)} kcal`}
        </p>
        {exercise.notes && (
          <p className="text-[10px] text-muted-foreground/60 italic mt-0.5">{exercise.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Workout card ──────────────────────────────────────────────────────────────

function WorkoutCard({ workout, onToggleWorkout, onToggleExercise }: {
  workout: PlanWorkout;
  onToggleWorkout: () => void;
  onToggleExercise: (weId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const completedCount = workout.exercises.filter(e => e.completed).length;
  const total = workout.exercises.length;
  const allDone = total > 0 && completedCount === total;

  return (
    <Card className={`bg-[#1A1A1A] border-border/40 overflow-hidden transition-all ${workout.completed ? "border-primary/30" : ""}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          onClick={onToggleWorkout}
          className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
          aria-label={workout.completed ? "Mark incomplete" : "Mark complete"}
        >
          {workout.completed
            ? <CheckCircle2 className="w-6 h-6 text-primary" />
            : <Circle className="w-6 h-6" />}
        </button>

        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-semibold text-sm ${workout.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {workout.workout_name}
            </p>
            {workout.completed && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary shrink-0">
                Done
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Flame className="w-3 h-3" />
              {Math.round(workout.total_calories)} kcal
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {completedCount}/{total} done
            </span>
          </div>
        </button>

        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 text-muted-foreground"
        >
          {expanded
            ? <ChevronLeft className="w-4 h-4 -rotate-90" />
            : <ChevronRight className="w-4 h-4 rotate-90" />}
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="px-4 pb-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Exercises list (collapsed by default) */}
      {expanded && workout.exercises.length > 0 && (
        <div className="border-t border-border/30 px-4 divide-y divide-border/20">
          {workout.exercises.map(ex => (
            <ExerciseRow
              key={ex.id}
              exercise={ex}
              onToggle={() => onToggleExercise(ex.id)}
            />
          ))}
        </div>
      )}

      {expanded && workout.exercises.length === 0 && (
        <div className="border-t border-border/30 px-4 py-3 text-xs text-muted-foreground">
          No exercises in this workout yet.
        </div>
      )}

      {/* Mark workout complete button — shown when expanded */}
      {expanded && workout.exercises.length > 0 && (
        <div className="px-4 pb-3 pt-2">
          <button
            onClick={onToggleWorkout}
            className={`w-full text-center rounded-xl py-2.5 text-xs font-semibold transition-all ${
              workout.completed
                ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
                : allDone
                ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
                : "bg-muted text-muted-foreground border border-border/30 hover:bg-muted/80"
            }`}
          >
            {workout.completed ? "Completed — tap to undo" : allDone ? "Mark Workout Complete" : `Mark Complete (${total - completedCount} remaining)`}
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkoutPlan() {
  const [date, setDate] = useState(getTodayLocal());
  const [showCalendar, setShowCalendar] = useState(false);
  const queryClient = useQueryClient();
  const today = getTodayLocal();

  const { data: dayPlan, isLoading } = useQuery<DayWorkoutPlan>({
    queryKey: ["workout-plan", date],
    queryFn: () => customFetch<DayWorkoutPlan>(`${BASE}/workout-plan?date=${date}`),
  });

  // Toggle entire workout complete/incomplete
  const workoutCompleteMutation = useMutation({
    mutationFn: async ({ workoutId, completed }: { workoutId: number; completed: boolean }) => {
      if (completed) {
        // DELETE — pass date as query param
        return customFetch(`${BASE}/workout-plan/${workoutId}/complete?date=${date}`, {
          method: "DELETE",
        });
      }
      // POST — pass date in body
      return customFetch(`${BASE}/workout-plan/${workoutId}/complete`, {
        method: "POST",
        body: JSON.stringify({ date }),
      });
    },
    onMutate: async ({ workoutId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["workout-plan", date] });
      const prev = queryClient.getQueryData<DayWorkoutPlan>(["workout-plan", date]);
      if (prev) {
        queryClient.setQueryData<DayWorkoutPlan>(["workout-plan", date], {
          ...prev,
          workouts: prev.workouts.map(w => {
            if (w.id !== workoutId) return w;
            const nowComplete = !completed;
            return {
              ...w,
              completed: nowComplete,
              // When marking complete, also optimistically complete all exercises
              exercises: nowComplete
                ? w.exercises.map(e => ({ ...e, completed: true }))
                : w.exercises.map(e => ({ ...e, completed: false })),
            };
          }),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["workout-plan", date], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["workout-plan", date] }),
  });

  // Toggle individual exercise complete/incomplete
  const exerciseCompleteMutation = useMutation({
    mutationFn: async ({ workoutId, weId, completed }: { workoutId: number; weId: number; completed: boolean }) => {
      if (completed) {
        // DELETE — pass date as query param
        return customFetch(`${BASE}/workout-plan/${workoutId}/exercises/${weId}/complete?date=${date}`, {
          method: "DELETE",
        });
      }
      // POST — pass date in body
      return customFetch<{ workout_completed?: boolean }>(`${BASE}/workout-plan/${workoutId}/exercises/${weId}/complete`, {
        method: "POST",
        body: JSON.stringify({ date }),
      });
    },
    onMutate: async ({ workoutId, weId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["workout-plan", date] });
      const prev = queryClient.getQueryData<DayWorkoutPlan>(["workout-plan", date]);
      if (prev) {
        queryClient.setQueryData<DayWorkoutPlan>(["workout-plan", date], {
          ...prev,
          workouts: prev.workouts.map(w => {
            if (w.id !== workoutId) return w;
            const updatedExercises = w.exercises.map(e =>
              e.id === weId ? { ...e, completed: !completed } : e
            );
            const allDone = updatedExercises.length > 0 && updatedExercises.every(e => e.completed);
            return {
              ...w,
              exercises: updatedExercises,
              // Auto-complete workout optimistically if all exercises are now done
              completed: !completed ? (allDone ? true : w.completed) : false,
            };
          }),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["workout-plan", date], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["workout-plan", date] }),
  });

  const workouts = dayPlan?.workouts ?? [];
  const totalCalories = workouts.reduce((sum, w) => sum + w.total_calories, 0);
  const completedWorkouts = workouts.filter(w => w.completed).length;

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/dashboard">
            <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-base font-bold flex-1">Workout Plan</h1>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <button
            onClick={() => setDate(offsetDate(date, -1))}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowCalendar(true)}
            className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">
              {formatDisplay(date)}
            </span>
            {dayPlan?.day_of_week && (
              <span className="text-xs text-muted-foreground">
                · {formatDayOfWeek(dayPlan.day_of_week)}
              </span>
            )}
          </button>

          <button
            onClick={() => setDate(offsetDate(date, 1))}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Jump to today */}
        {date !== today && (
          <div className="px-4 pb-2">
            <button
              onClick={() => setDate(today)}
              className="w-full text-center text-xs text-primary py-1 hover:underline"
            >
              Back to today
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4 pb-24">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && workouts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Dumbbell className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">No workouts scheduled</p>
              <p className="text-sm text-muted-foreground">
                {dayPlan?.day_of_week
                  ? `No workouts are scheduled for ${formatDayOfWeek(dayPlan.day_of_week)}s.`
                  : "No workouts scheduled for this day."}
              </p>
            </div>
            <Link href="/training/builder">
              <button className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                Open Exercise Builder
              </button>
            </Link>
          </div>
        )}

        {!isLoading && workouts.length > 0 && (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#1A1A1A] rounded-xl px-3 py-2.5 text-center">
                <div className="text-base font-bold tabular-nums text-foreground">
                  {workouts.length}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Workout{workouts.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="bg-primary/15 border border-primary/30 rounded-xl px-3 py-2.5 text-center">
                <div className="text-base font-bold tabular-nums text-primary">
                  {Math.round(totalCalories)}<span className="text-[10px] font-medium ml-0.5">kcal</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Est. Burn</div>
              </div>
              <div className="bg-[#1A1A1A] rounded-xl px-3 py-2.5 text-center">
                <div className="text-base font-bold tabular-nums text-foreground">
                  {completedWorkouts}/{workouts.length}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Done</div>
              </div>
            </div>

            {/* Workout cards */}
            <div className="space-y-3">
              {workouts.map(workout => (
                <WorkoutCard
                  key={workout.id}
                  workout={workout}
                  onToggleWorkout={() =>
                    workoutCompleteMutation.mutate({ workoutId: workout.id, completed: workout.completed })
                  }
                  onToggleExercise={(weId) => {
                    const ex = workout.exercises.find(e => e.id === weId);
                    if (ex) {
                      exerciseCompleteMutation.mutate({
                        workoutId: workout.id,
                        weId,
                        completed: ex.completed,
                      });
                    }
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Calendar */}
      {showCalendar && (
        <CalendarPicker
          selectedDate={date}
          onSelectDate={setDate}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
}
