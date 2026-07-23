// Canonical workout calorie estimation — single source of truth.
// Extracted from routes/workout-plan.ts (Reis et al. 2017, PMC5524349) so the
// dashboard, plan and workout endpoints can never disagree on the same workout.

const INTENSITY_MULTIPLIER: Record<string, number> = { light: 0.80, moderate: 1.00, heavy: 1.25 };
const FALLBACK_MET = 4.0;

export function estimateStrengthCalories(
  sets: number, repsMin: number, repsMax: number, restSecs: number,
  weightKg: number, effort = "moderate", exerciseMet?: number,
): number {
  const avgReps = (repsMin + repsMax) / 2;
  const durationMins = (sets * (avgReps * 3 + restSecs)) / 60;
  const baseMet = exerciseMet ?? FALLBACK_MET;
  const met = baseMet * (INTENSITY_MULTIPLIER[effort] ?? 1.0);
  return +(met * weightKg * (durationMins / 60)).toFixed(1);
}

export function estimateCardioCalories(metValue: number, durationMins: number, weightKg: number): number {
  return +(metValue * weightKg * (durationMins / 60)).toFixed(1);
}

/** Calories for one workout_exercises row joined with its exercise. */
export function calcExerciseRowCalories(row: {
  exercise_type: string; met_value: string | number | null;
  sets: string | number; reps_min: string | number; reps_max: string | number;
  rest_seconds: string | number; duration_mins: string | number | null;
  effort_level: string | null;
}, weightKg: number): number {
  if (row.exercise_type === "cardio") {
    return estimateCardioCalories(Number(row.met_value) || 5, Number(row.duration_mins) || 0, weightKg);
  }
  const exerciseMet = row.met_value != null ? Number(row.met_value) : undefined;
  return estimateStrengthCalories(
    Number(row.sets), Number(row.reps_min), Number(row.reps_max), Number(row.rest_seconds),
    weightKg, row.effort_level || "moderate", exerciseMet,
  );
}
