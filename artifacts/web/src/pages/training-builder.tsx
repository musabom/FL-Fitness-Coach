import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/language-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ChevronLeft, Plus, Trash2, Pencil, Check, X, Search, Loader2,
  Dumbbell, Flame, ChevronDown, ChevronUp, GripVertical, Timer,
  Zap, ArrowUp, ArrowDown, Activity, RotateCcw
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getExerciseImageUrl } from "@/lib/exercise-images";
import { useCoachClient, useClientUrl } from "@/context/coach-client-context";
import BottomNav from "@/components/bottom-nav";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Exercise {
  id: number;
  exercise_name: string;
  name_arabic: string;
  muscle_primary: string;
  exercise_type: "strength" | "cardio";
  equipment: string;
  met_value?: number;
  is_custom?: boolean;
}

interface WorkoutExercise {
  id: number;
  workout_id: number;
  exercise_id: number;
  exercise_name: string;
  muscle_primary: string;
  exercise_type: "strength" | "cardio";
  met_value?: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  weight_kg?: number;
  rest_seconds: number;
  duration_mins?: number;
  speed_kmh?: number;
  effort_level?: string;
  order_index: number;
  notes?: string;
  estimated_calories: number;
  duration_mins_computed: number;
}

interface Workout {
  id: number;
  workout_name: string;
  scheduled_days: string[];
  exercises: WorkoutExercise[];
  total_calories: number;
}

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");
const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday:"Mon", tuesday:"Tue", wednesday:"Wed", thursday:"Thu",
  friday:"Fri", saturday:"Sat", sunday:"Sun"
};
const MUSCLE_FILTERS = ["all","chest","back","shoulders","arms","legs","cardio"] as const;
const MUSCLE_LABELS: Record<string, string> = {
  all:"All", chest:"Chest", back:"Back", shoulders:"Shoulders",
  arms:"Arms", legs:"Legs", cardio:"Cardio"
};
const EQUIPMENT_ICONS: Record<string, string> = {
  barbell:"[B]", dumbbell:"[D]", machine:"[M]", cable:"[C]", bodyweight:"[BW]"
};

// ── Utility ───────────────────────────────────────────────────────────────────

function todayDayName() {
  return ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date().getDay()];
}

// ── Create Custom Exercise Sheet ──────────────────────────────────────────────

interface CreateCustomExerciseSheetProps {
  open: boolean;
  onClose: () => void;
}

function CreateCustomExerciseSheet({ open, onClose }: CreateCustomExerciseSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState<"strength" | "cardio">("strength");
  const [muscle, setMuscle] = useState("chest");
  const [equipment, setEquipment] = useState("dumbbell");
  const [injuries, setInjuries] = useState<string[]>([]);
  const [formCue, setFormCue] = useState("");
  const [lightMet, setLightMet] = useState("4.0");
  const [moderateMet, setModerateMet] = useState("6.0");
  const [vigorousMet, setVigorousMet] = useState("8.0");

  const createMutation = useMutation({
    mutationFn: (body: any) => customFetch(`${BASE}/exercises`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      toast({ title: "Custom exercise created" });
      onClose();
      resetForm();
    },
    onError: () => toast({ title: "Failed to create exercise", variant: "destructive" }),
  });

  function resetForm() {
    setName(""); setType("strength"); setMuscle("chest"); setEquipment("dumbbell");
    setInjuries([]); setFormCue(""); setLightMet("4.0"); setModerateMet("6.0"); setVigorousMet("8.0");
  }

  function handleSave() {
    if (!name.trim()) return toast({ title: "Exercise name is required", variant: "destructive" });
    createMutation.mutate({
      exercise_name: name.trim(),
      exercise_type: type,
      muscle_primary: muscle,
      equipment,
      injury_contraindications: injuries.length > 0 ? injuries : ["none"],
      form_cue: formCue.trim() || null,
      light_met: type === "cardio" ? Number(lightMet) || 4.0 : undefined,
      moderate_met: type === "cardio" ? Number(moderateMet) || 6.0 : undefined,
      vigorous_met: type === "cardio" ? Number(vigorousMet) || 8.0 : undefined,
    });
  }

  if (!open) return null;

  const muscles = ["chest", "back", "shoulders", "biceps", "triceps", "legs", "other"];
  const equipmentOptions = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "band", "other"];
  const injuryOptions = ["knee", "shoulder", "lower back"];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111] rounded-t-2xl border-t border-border/40 z-10 max-h-[90vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-border/60" /></div>
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="font-semibold text-sm">Create Custom Exercise</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-20 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Exercise Name *</label>
            <Input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cable Flyes" className="bg-[#1A1A1A] border-border/40 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type *</label>
              <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-[#1A1A1A] border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
                <option value="strength">Strength</option>
                <option value="cardio">Cardio</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Muscle Group *</label>
              <select value={muscle} onChange={e => setMuscle(e.target.value)} className="w-full bg-[#1A1A1A] border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
                {muscles.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Equipment *</label>
              <select value={equipment} onChange={e => setEquipment(e.target.value)} className="w-full bg-[#1A1A1A] border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
                {equipmentOptions.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Injury Concerns</label>
              <div className="space-y-1.5">
                {injuryOptions.map(inj => (
                  <label key={inj} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={injuries.includes(inj)}
                      onChange={e => setInjuries(e.target.checked ? [...injuries, inj] : injuries.filter(i => i !== inj))}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-muted-foreground capitalize">{inj}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Form Cue (optional)</label>
            <Input type="text" value={formCue} onChange={e => setFormCue(e.target.value)} placeholder="e.g. Keep elbows high" className="bg-[#1A1A1A] border-border/40 text-sm" />
          </div>

          {type === "cardio" && (
            <>
              <div className="pt-2 border-t border-border/40">
                <p className="text-xs font-medium text-foreground mb-3">MET Values</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Light</label>
                    <Input type="number" step="0.5" value={lightMet} onChange={e => setLightMet(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Moderate</label>
                    <Input type="number" step="0.5" value={moderateMet} onChange={e => setModerateMet(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Vigorous</label>
                    <Input type="number" step="0.5" value={vigorousMet} onChange={e => setVigorousMet(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" />
                  </div>
                </div>
              </div>
            </>
          )}

          <Button onClick={handleSave} disabled={createMutation.isPending} className="w-full bg-primary text-primary-foreground mt-4">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Create Exercise"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Add Exercise Sheet ────────────────────────────────────────────────────────

interface AddExerciseSheetProps {
  workoutId: number;
  open: boolean;
  onClose: () => void;
  onOpenCustomExercise: () => void;
}

function AddExerciseSheet({ workoutId, open, onClose, onOpenCustomExercise }: AddExerciseSheetProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeClient } = useCoachClient();
  const buildUrl = useClientUrl();
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string>("all");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // Strength fields
  const [sets, setSets] = useState("4");
  const [repsMin, setRepsMin] = useState("12");
  const [repsMax, setRepsMax] = useState("15");
  const [weightKg, setWeightKg] = useState("");
  const [restSecs, setRestSecs] = useState("60");

  // Cardio fields
  const [durationMins, setDurationMins] = useState("30");
  const [speedKmh, setSpeedKmh] = useState("");
  const [intensity, setIntensity] = useState("moderate");

  const { data: userProfile } = useQuery<any>({
    queryKey: ["user-profile", activeClient?.id],
    queryFn: () => customFetch(buildUrl(`${BASE}/profile`)),
    enabled: open,
  });

  const { data: exercises = [], isLoading: exercisesLoading } = useQuery<Exercise[]>({
    queryKey: ["exercises", search, muscleFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (muscleFilter !== "all") params.set("muscle", muscleFilter);
      return customFetch(`${BASE}/exercises?${params}`);
    },
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: (body: any) => customFetch(buildUrl(`${BASE}/workouts/${workoutId}/exercises`), { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workouts-today"] });
      toast({ title: "Exercise added" });
      onClose();
      resetForm();
    },
    onError: () => toast({ title: "Failed to add exercise", variant: "destructive" }),
  });

  function resetForm() {
    setSelectedExercise(null);
    setSearch("");
    setSets("4"); setRepsMin("12"); setRepsMax("15"); setWeightKg(""); setRestSecs("60");
    setDurationMins("30"); setSpeedKmh(""); setIntensity("moderate");
  }

  const userWeight = userProfile?.weightKg ? Number(userProfile.weightKg) : null;

  // Cardio-specific MET lookups
  const getCardioMET = (exerciseName: string, speed: number | null, intensityLevel: string): number => {
    if (!selectedExercise) return 5;
    const name = selectedExercise.exercise_name;
    const hasSpeed = speed !== null && speed > 0;

    // Treadmill Walk/Run: use met_value from database
    if (name === "Treadmill Walk" || name === "Treadmill Run") {
      return Number(selectedExercise.met_value) || 4.3;
    }

    // Elliptical or Stationary Bike: speed-based or intensity-based
    if (name === "Elliptical" || name === "Stationary Bike") {
      if (hasSpeed) {
        if (speed < 10) return 4.0;
        if (speed <= 15) return 5.5;
        return 7.0;
      }
      // Use intensity-based MET
      if (intensityLevel === "light") return 4.0;
      if (intensityLevel === "vigorous") return 7.0;
      return 5.5; // moderate
    }

    // Rowing Machine: intensity-based
    if (name === "Rowing Machine") {
      if (intensityLevel === "light") return 4.0;
      if (intensityLevel === "vigorous") return 8.5;
      return 7.0; // moderate
    }

    // Jump Rope: intensity-based
    if (name === "Jump Rope") {
      if (intensityLevel === "light") return 8.0;
      if (intensityLevel === "vigorous") return 12.0;
      return 10.0; // moderate
    }

    // Stair Climber: intensity-based
    if (name === "Stair Climber") {
      if (intensityLevel === "light") return 6.0;
      if (intensityLevel === "vigorous") return 12.0;
      return 9.0; // moderate
    }

    return 5.0; // fallback
  };

  const liveCalories = selectedExercise && userWeight
    ? (() => {
        if (selectedExercise.exercise_type === "strength") {
          // Strength: effort_MET (5.0 default) × weight × (duration / 60)
          const durationMins = (Number(sets) * ((Number(repsMin) + Number(repsMax)) / 2 * 3 + Number(restSecs))) / 60;
          return +(5.0 * userWeight * (durationMins / 60)).toFixed(0);
        } else {
          // Cardio: MET × weight × (duration / 60)
          const met = getCardioMET(selectedExercise.exercise_name, speedKmh ? Number(speedKmh) : null, intensity);
          return +(met * userWeight * (Number(durationMins) / 60)).toFixed(0);
        }
      })()
    : 0;

  function handleAdd() {
    if (!selectedExercise) return;
    const base = { exercise_id: selectedExercise.id, order_index: 99 };
    if (selectedExercise.exercise_type === "cardio") {
      addMutation.mutate({ ...base, duration_mins: Number(durationMins), speed_kmh: speedKmh ? Number(speedKmh) : null, effort_level: intensity });
    } else {
      addMutation.mutate({ ...base, sets: Number(sets), reps_min: Number(repsMin), reps_max: Number(repsMax), weight_kg: weightKg ? Number(weightKg) : null, rest_seconds: Number(restSecs) });
    }
  }

  const needsSpeed = selectedExercise?.exercise_name === "Treadmill Walk" || selectedExercise?.exercise_name === "Treadmill Run";
  const needsIntensity = selectedExercise && (selectedExercise.exercise_name === "Rowing Machine" || selectedExercise.exercise_name === "Jump Rope" || selectedExercise.exercise_name === "Stair Climber");
  const needsSpeedOrIntensity = selectedExercise && (selectedExercise.exercise_name === "Elliptical" || selectedExercise.exercise_name === "Stationary Bike");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { onClose(); resetForm(); }} />
      <div className="relative bg-[#111] rounded-t-2xl max-h-[90vh] flex flex-col border-t border-border/40 z-10">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="font-semibold text-base">
            {selectedExercise ? selectedExercise.exercise_name : "Add Exercise"}
          </h2>
          {selectedExercise
            ? <button onClick={() => setSelectedExercise(null)} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5" /></button>
            : <button onClick={() => { onClose(); resetForm(); }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          }
        </div>

        {!selectedExercise ? (
          <>
            {/* Search */}
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search exercises…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-[#1A1A1A] border-border/40 text-sm"
                />
              </div>
            </div>
            {/* Muscle filter tabs */}
            <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
              {MUSCLE_FILTERS.map(m => (
                <button
                  key={m}
                  onClick={() => setMuscleFilter(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all border ${
                    muscleFilter === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border/40 hover:border-primary/40"
                  }`}
                >
                  {MUSCLE_LABELS[m]}
                </button>
              ))}
            </div>
            {/* Exercise list */}
            <div className="overflow-y-auto flex-1 px-4 pb-20 space-y-2">
              {exercisesLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
              {!exercisesLoading && exercises.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <p className="text-center text-muted-foreground text-sm">No exercises found</p>
                  <Button onClick={onOpenCustomExercise} size="sm" className="bg-primary text-primary-foreground">
                    Add Custom Exercise
                  </Button>
                </div>
              )}
              {exercises.map(ex => {
                const imgUrl = getExerciseImageUrl(ex.exercise_name);
                return (
                  <button
                    key={ex.id}
                    onClick={() => setSelectedExercise(ex)}
                    className="w-full text-left p-3 rounded-xl bg-[#1A1A1A] border border-border/30 hover:border-primary/40 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {imgUrl ? (
                        <img src={imgUrl} alt={ex.exercise_name} className="w-10 h-10 rounded object-cover bg-white/5 flex-shrink-0" />
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">{EQUIPMENT_ICONS[ex.equipment] || "[E]"}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm text-foreground truncate">{ex.exercise_name}</p>
                          {ex.is_custom && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 whitespace-nowrap">Custom</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{ex.muscle_primary} · {ex.equipment}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ex.exercise_type === "cardio" ? "bg-blue-500/15 text-blue-400" : "bg-primary/10 text-primary"}`}>
                        {ex.exercise_type}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="overflow-y-auto flex-1 px-4 pb-20 space-y-4">
            {/* Exercise image */}
            {getExerciseImageUrl(selectedExercise.exercise_name) && (
              <img
                src={getExerciseImageUrl(selectedExercise.exercise_name)!}
                alt={selectedExercise.exercise_name}
                className="w-full h-48 rounded-xl object-cover bg-white/5"
              />
            )}

            {/* Exercise info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1A1A1A] border border-border/30">
              <span className="text-xs font-semibold text-muted-foreground px-2 py-1 bg-muted/30 rounded">{EQUIPMENT_ICONS[selectedExercise.equipment] || "[E]"}</span>
              <div>
                <p className="text-sm font-medium">{selectedExercise.exercise_name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{selectedExercise.muscle_primary} · {selectedExercise.exercise_type}</p>
              </div>
            </div>

            {/* Live calorie estimate */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <Flame className="w-4 h-4 text-primary" />
              {userWeight ? (
                <>
                  <p className="text-sm font-medium text-primary">Est. ~{liveCalories} kcal</p>
                  <p className="text-xs text-muted-foreground">(for {userWeight}kg body weight)</p>
                </>
              ) : (
                <p className="text-sm text-primary font-medium">Complete your profile to see calorie estimates</p>
              )}
            </div>

            {selectedExercise.exercise_type === "strength" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Sets</label>
                    <Input type="number" min="1" value={sets} onChange={e => setSets(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Reps Min</label>
                    <Input type="number" min="1" value={repsMin} onChange={e => setRepsMin(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Reps Max</label>
                    <Input type="number" min="1" value={repsMax} onChange={e => setRepsMax(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Rest (seconds)</label>
                    <Input type="number" min="0" step="15" value={restSecs} onChange={e => setRestSecs(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Weight kg (optional, for tracking only)</label>
                  <Input type="number" min="0" step="2.5" placeholder="Optional" value={weightKg} onChange={e => setWeightKg(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Duration (minutes)</label>
                  <Input type="number" min="1" value={durationMins} onChange={e => setDurationMins(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" />
                </div>
                {needsSpeed && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Speed km/h</label>
                    <Input type="number" min="0" step="0.5" placeholder="e.g. 8.0" value={speedKmh} onChange={e => setSpeedKmh(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" />
                  </div>
                )}
                {needsSpeedOrIntensity && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Speed km/h (optional)</label>
                      <Input type="number" min="0" step="0.5" placeholder="e.g. 12.0" value={speedKmh} onChange={e => setSpeedKmh(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" />
                    </div>
                    {!speedKmh && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block">Intensity</label>
                        <div className="flex gap-2">
                          {["light","moderate","vigorous"].map(level => (
                            <button
                              key={level}
                              onClick={() => setIntensity(level)}
                              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                                intensity === level
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-transparent text-muted-foreground border-border/40"
                              }`}
                            >
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {needsIntensity && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">Intensity</label>
                    <div className="flex gap-2">
                      {["light","moderate","vigorous"].map(level => (
                        <button
                          key={level}
                          onClick={() => setIntensity(level)}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                            intensity === level
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-transparent text-muted-foreground border-border/40"
                          }`}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleAdd} disabled={addMutation.isPending} className="w-full bg-primary text-primary-foreground">
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to Workout"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit Exercise Inline ───────────────────────────────────────────────────────

interface EditExerciseSheetProps {
  we: WorkoutExercise;
  workoutId: number;
  open: boolean;
  onClose: () => void;
}

function EditExerciseSheet({ we, workoutId, open, onClose }: EditExerciseSheetProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const buildUrl = useClientUrl();
  const [sets, setSets] = useState(String(we.sets));
  const [repsMin, setRepsMin] = useState(String(we.reps_min));
  const [repsMax, setRepsMax] = useState(String(we.reps_max));
  const [weightKg, setWeightKg] = useState(we.weight_kg ? String(we.weight_kg) : "");
  const [restSecs, setRestSecs] = useState(String(we.rest_seconds));
  const [durationMins, setDurationMins] = useState(String(we.duration_mins ?? 30));
  const [speedKmh, setSpeedKmh] = useState(we.speed_kmh ? String(we.speed_kmh) : "");
  const [intensity, setIntensity] = useState(we.effort_level || "moderate");

  const saveMutation = useMutation({
    mutationFn: (body: any) => customFetch(buildUrl(`${BASE}/workouts/${workoutId}/exercises/${we.id}`), { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workouts-today"] });
      toast({ title: "Saved" });
      onClose();
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  function handleSave() {
    if (we.exercise_type === "cardio") {
      saveMutation.mutate({ duration_mins: Number(durationMins), speed_kmh: speedKmh ? Number(speedKmh) : null, effort_level: intensity });
    } else {
      saveMutation.mutate({ sets: Number(sets), reps_min: Number(repsMin), reps_max: Number(repsMax), weight_kg: weightKg ? Number(weightKg) : null, rest_seconds: Number(restSecs) });
    }
  }

  const needsSpeed = we.exercise_name === "Treadmill Walk" || we.exercise_name === "Treadmill Run";
  const needsIntensity = we.exercise_name === "Rowing Machine" || we.exercise_name === "Jump Rope" || we.exercise_name === "Stair Climber";
  const needsSpeedOrIntensity = we.exercise_name === "Elliptical" || we.exercise_name === "Stationary Bike";

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111] rounded-t-2xl border-t border-border/40 z-10">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-border/60" /></div>
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="font-semibold text-sm">{we.exercise_name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-4 pb-6 space-y-3">
          {we.exercise_type === "strength" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground mb-1 block">Sets</label><Input type="number" value={sets} onChange={e => setSets(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Reps Min</label><Input type="number" value={repsMin} onChange={e => setRepsMin(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground mb-1 block">Reps Max</label><Input type="number" value={repsMax} onChange={e => setRepsMax(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Rest (sec)</label><Input type="number" step="15" value={restSecs} onChange={e => setRestSecs(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Weight kg (optional, for tracking only)</label><Input type="number" step="2.5" placeholder="Optional" value={weightKg} onChange={e => setWeightKg(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" /></div>
            </>
          ) : (
            <>
              <div><label className="text-xs text-muted-foreground mb-1 block">Duration (min)</label><Input type="number" value={durationMins} onChange={e => setDurationMins(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" /></div>
              {needsSpeed && (
                <div><label className="text-xs text-muted-foreground mb-1 block">Speed km/h</label><Input type="number" step="0.5" placeholder="e.g. 8.0" value={speedKmh} onChange={e => setSpeedKmh(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" /></div>
              )}
              {needsSpeedOrIntensity && (
                <>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Speed km/h (optional)</label><Input type="number" step="0.5" placeholder="e.g. 12.0" value={speedKmh} onChange={e => setSpeedKmh(e.target.value)} className="bg-[#1A1A1A] border-border/40 text-sm" /></div>
                  {!speedKmh && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">Intensity</label>
                      <div className="flex gap-2">
                        {["light","moderate","vigorous"].map(level => (
                          <button key={level} onClick={() => setIntensity(level)} className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${intensity === level ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border/40"}`}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {needsIntensity && (
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Intensity</label>
                  <div className="flex gap-2">
                    {["light","moderate","vigorous"].map(level => (
                      <button key={level} onClick={() => setIntensity(level)} className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${intensity === level ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border/40"}`}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full bg-primary text-primary-foreground">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Exercise Row ───────────────────────────────────────────────────────────────

interface ExerciseRowProps {
  we: WorkoutExercise;
  workoutId: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ExerciseRow({ we, workoutId, isFirst, isLast, onMoveUp, onMoveDown }: ExerciseRowProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const buildUrl = useClientUrl();
  const [editOpen, setEditOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => customFetch(buildUrl(`${BASE}/workouts/${workoutId}/exercises/${we.id}`), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workouts-today"] });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const detail = we.exercise_type === "cardio"
    ? `${we.duration_mins ?? "?"}min${we.speed_kmh ? ` · ${we.speed_kmh}km/h` : ""}`
    : `${we.sets}×${we.reps_min}–${we.reps_max}${we.weight_kg ? ` · ${we.weight_kg}kg` : ""}`;

  return (
    <>
      <div className="flex items-center gap-2 py-2 border-b border-border/20 last:border-0">
        {/* Reorder */}
        <div className="flex flex-col gap-0.5">
          <button onClick={onMoveUp} disabled={isFirst} className="text-muted-foreground disabled:opacity-20 hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
          <button onClick={onMoveDown} disabled={isLast} className="text-muted-foreground disabled:opacity-20 hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{we.exercise_name}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>

        {/* Calories */}
        <div className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
          <Flame className="w-3 h-3 text-amber-500" />
          <span>{Math.round(we.estimated_calories)}</span>
        </div>

        {/* Actions */}
        <button onClick={() => setEditOpen(true)} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
          {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <EditExerciseSheet we={we} workoutId={workoutId} open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}

// ── Workout Card ───────────────────────────────────────────────────────────────

interface WorkoutCardProps {
  workout: Workout;
}

function WorkoutCard({ workout }: WorkoutCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const buildUrl = useClientUrl();
  const [expanded, setExpanded] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [customExerciseOpen, setCustomExerciseOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(workout.workout_name);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (renaming) nameRef.current?.focus(); }, [renaming]);

  const renameMutation = useMutation({
    mutationFn: (workout_name: string) => customFetch(buildUrl(`${BASE}/workouts/${workout.id}`), { method: "PATCH", body: JSON.stringify({ workout_name }), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workouts"] }); setRenaming(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => customFetch(buildUrl(`${BASE}/workouts/${workout.id}`), { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workouts"] }); queryClient.invalidateQueries({ queryKey: ["workouts-today"] }); },
    onError: () => toast({ title: "Failed to delete workout", variant: "destructive" }),
  });

  const scheduleMutation = useMutation({
    mutationFn: (days: string[]) => customFetch(buildUrl(`${BASE}/workouts/${workout.id}/schedule`), { method: "POST", body: JSON.stringify({ days }), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workouts"] }); queryClient.invalidateQueries({ queryKey: ["workouts-today"] }); },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ exId, order_index }: { exId: number; order_index: number }) =>
      customFetch(buildUrl(`${BASE}/workouts/${workout.id}/exercises/${exId}`), { method: "PATCH", body: JSON.stringify({ order_index }), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  });

  function toggleDay(day: string) {
    const current = workout.scheduled_days;
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    scheduleMutation.mutate(next);
  }

  function moveExercise(idx: number, dir: -1 | 1) {
    const exercises = [...workout.exercises];
    const target = exercises[idx + dir];
    const current = exercises[idx];
    reorderMutation.mutate({ exId: current.id, order_index: target.order_index });
    reorderMutation.mutate({ exId: target.id, order_index: current.order_index });
  }

  return (
    <>
      <Card className="bg-[#1A1A1A] border-border/40 overflow-hidden">
        {/* Workout header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
          {renaming ? (
            <div className="flex-1 flex items-center gap-2">
              <Input
                ref={nameRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") renameMutation.mutate(name);
                  if (e.key === "Escape") { setRenaming(false); setName(workout.workout_name); }
                }}
                className="h-7 text-sm bg-transparent border-primary flex-1"
              />
              <button onClick={() => renameMutation.mutate(name)} className="text-primary"><Check className="w-4 h-4" /></button>
              <button onClick={() => { setRenaming(false); setName(workout.workout_name); }} className="text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <>
              <button onClick={() => setExpanded(v => !v)} className="flex-1 flex items-center gap-2 text-left">
                <span className="font-semibold text-sm">{workout.workout_name}</span>
                {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <div className="flex items-center gap-1 text-xs text-amber-500 mr-2">
                  <Flame className="w-3.5 h-3.5" />
                  <span className="font-medium">{Math.round(workout.total_calories)} kcal</span>
                </div>
                <button onClick={() => setRenaming(true)} className="text-muted-foreground hover:text-foreground p-1"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => { if (confirm("Delete this workout?")) deleteMutation.mutate(); }} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>

        {expanded && (
          <div className="px-4 py-3 space-y-4">
            {/* Day selector */}
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">Scheduled Days</div>
              <button
                onClick={() => {
                  const allSelected = DAYS.every(d => workout.scheduled_days.includes(d));
                  scheduleMutation.mutate(allSelected ? [] : [...DAYS]);
                }}
                className={`text-xs font-medium px-2 py-0.5 rounded-md border transition-all ${
                  DAYS.every(d => workout.scheduled_days.includes(d))
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border/30 hover:border-primary/40"
                }`}
              >
                All Days
              </button>
            </div>
            <div className="flex gap-1.5">
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all border ${
                    workout.scheduled_days.includes(day)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border/30 hover:border-primary/40"
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>

            {/* Exercises */}
            {workout.exercises.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No exercises yet. Tap below to add.</p>
            ) : (
              <div>
                {workout.exercises.map((we, idx) => (
                  <ExerciseRow
                    key={we.id}
                    we={we}
                    workoutId={workout.id}
                    isFirst={idx === 0}
                    isLast={idx === workout.exercises.length - 1}
                    onMoveUp={() => moveExercise(idx, -1)}
                    onMoveDown={() => moveExercise(idx, 1)}
                  />
                ))}
              </div>
            )}

            {/* Add exercise button */}
            <button
              onClick={() => setAddOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-border/50 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Exercise
            </button>
          </div>
        )}
      </Card>

      <AddExerciseSheet workoutId={workout.id} open={addOpen} onClose={() => setAddOpen(false)} onOpenCustomExercise={() => { setAddOpen(false); setCustomExerciseOpen(true); }} />
      <CreateCustomExerciseSheet open={customExerciseOpen} onClose={() => setCustomExerciseOpen(false)} />
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TrainingBuilder() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeClient } = useCoachClient();
  const buildUrl = useClientUrl();
  const [customExerciseOpen, setCustomExerciseOpen] = useState(false);

  const today = todayDayName();

  const { data: workouts = [], isLoading } = useQuery<Workout[]>({
    queryKey: ["workouts", activeClient?.id],
    queryFn: () => customFetch(buildUrl(`${BASE}/workouts`)),
  });

  const { data: todayWorkouts = [] } = useQuery<Workout[]>({
    queryKey: ["workouts-today", today, activeClient?.id],
    queryFn: () => customFetch(buildUrl(`${BASE}/workouts/day/${today}`)),
  });

  const createMutation = useMutation({
    mutationFn: () => customFetch(buildUrl(`${BASE}/workouts`), { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      toast({ title: "Workout created" });
    },
    onError: () => toast({ title: "Failed to create workout", variant: "destructive" }),
  });

  const todayBurn = todayWorkouts.reduce((sum, w) => sum + w.total_calories, 0);

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-foreground max-w-2xl mx-auto flex flex-col pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-border/30 sticky top-0 bg-[#0F0F0F]/90 backdrop-blur-xl z-10">
        <Link href="/dashboard">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-base flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-primary" />
            {t("trainingBuilder.title")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/training/cycle">
            <button className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-xs font-medium">
              <RotateCcw className="w-3.5 h-3.5" />
              Cycle
            </button>
          </Link>
          <button onClick={() => setCustomExerciseOpen(true)} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-xs font-medium">
            <Plus className="w-3.5 h-3.5" />
            Custom
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Today's burn summary */}
        <Card className="bg-[#1A1A1A] border-border/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Today's Estimated Burn</p>
                <p className="text-sm text-muted-foreground capitalize">{today}</p>
              </div>
            </div>
            <div className="text-right">
              {todayBurn > 0 ? (
                <>
                  <p className="text-3xl font-light text-primary">{Math.round(todayBurn)}</p>
                  <p className="text-xs text-muted-foreground">kcal</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No workouts scheduled</p>
              )}
            </div>
          </div>
          {todayWorkouts.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/20 space-y-1">
              {todayWorkouts.map(w => (
                <div key={w.id} className="flex justify-between text-xs text-muted-foreground">
                  <span>{w.workout_name}</span>
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-500" />
                    {Math.round(w.total_calories)} kcal
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && workouts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
              <Dumbbell className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No workouts yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first workout and add exercises from the library.</p>
            </div>
          </div>
        )}

        {/* Workout cards */}
        {!isLoading && workouts.map(w => (
          <WorkoutCard key={w.id} workout={w} />
        ))}

        {/* Add workout button */}
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="w-full bg-primary text-primary-foreground font-semibold"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Add Workout
        </Button>

        <div className="pb-8" />
      </div>

      <CreateCustomExerciseSheet open={customExerciseOpen} onClose={() => setCustomExerciseOpen(false)} />
      <BottomNav />
    </div>
  );
}
