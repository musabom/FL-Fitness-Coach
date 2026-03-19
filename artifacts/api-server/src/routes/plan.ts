import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, plansTable, userProfilesTable, pool } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

// ── Calorie estimation helpers (same as in workouts.ts) ─────────────────────
const EFFORT_MET: Record<string, number> = { light: 3.5, moderate: 5.0, heavy: 6.0 };

function estimateStrengthCalories(sets: number, repsMin: number, repsMax: number, restSecs: number, weightKg: number, effort = "moderate") {
  const avgReps = (repsMin + repsMax) / 2;
  const durationMins = (sets * (avgReps * 3 + restSecs)) / 60;
  const met = EFFORT_MET[effort] ?? EFFORT_MET.moderate;
  return +(met * weightKg * (durationMins / 60)).toFixed(1);
}

function estimateCardioCalories(metValue: number, durationMins: number, weightKg: number) {
  return +(metValue * weightKg * (durationMins / 60)).toFixed(1);
}

async function getAvgDailyPlannedBurn(userId: number, weightKg: number = 70): Promise<number> {
  // Get user's weight for accurate calorie estimation
  const profileRes = await pool.query(
    `SELECT weight_kg FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  const userWeightKg = profileRes.rows[0]?.weight_kg ?? weightKg;

  // Query planned training burn from scheduled workouts
  const res = await pool.query(
    `SELECT ws.day_of_week, we.id as exercise_id, e.exercise_type, we.sets, we.reps_min, we.reps_max, we.rest_seconds, we.duration_mins, we.effort_level, e.met_value
     FROM workout_schedule ws
     JOIN user_workouts uw ON ws.workout_id = uw.id AND uw.user_id = $1
     JOIN workout_exercises we ON uw.id = we.workout_id
     JOIN exercises e ON we.exercise_id = e.id
     WHERE ws.user_id = $1`,
    [userId]
  );

  // Group by day_of_week and calculate total calories per day
  const calorisByDay: Record<string, number> = {};
  for (const row of res.rows) {
    const day = row.day_of_week;
    let estimated_calories = 0;
    if (row.exercise_type === "cardio") {
      estimated_calories = estimateCardioCalories(Number(row.met_value) || 5, Number(row.duration_mins) || 0, userWeightKg);
    } else {
      estimated_calories = estimateStrengthCalories(Number(row.sets), Number(row.reps_min), Number(row.reps_max), Number(row.rest_seconds), userWeightKg, row.effort_level || "moderate");
    }
    calorisByDay[day] = (calorisByDay[day] || 0) + estimated_calories;
  }

  // Calculate average across 7 days
  const daysWithWorkouts = Object.values(calorisByDay);
  const totalCalories = daysWithWorkouts.reduce((sum, cal) => sum + cal, 0);
  return daysWithWorkouts.length > 0 ? Math.round(totalCalories / 7) : 0;
}

function recalculateTimeline(
  plan: any,
  currentWeightKg: number,
  targetWeightKg: number,
  avgDailyPlannedBurn: number
): { weeksEstimateLow: number | null; weeksEstimateHigh: number | null } {
  let weeksEstimateLow: number | null = null;
  let weeksEstimateHigh: number | null = null;

  const goalMode = plan.snapshotGoalMode;
  const weightGap = currentWeightKg - targetWeightKg;

  if (goalMode === "cut" || goalMode === "recomposition") {
    // Get food deficit from stored plan
    const foodDeficit = plan.tdeeEstimated - plan.calorieTarget;
    const totalAvgDailyDeficit = foodDeficit + avgDailyPlannedBurn;
    const weeklyLossKg = (totalAvgDailyDeficit * 7) / 7700;
    if (weightGap > 0 && weeklyLossKg > 0) {
      const weeksEstimate = weightGap / weeklyLossKg;
      weeksEstimateLow = Math.round(weeksEstimate * 0.8);
      weeksEstimateHigh = Math.round(weeksEstimate * 1.2);
    }
  } else if (goalMode === "lean_bulk") {
    // For lean bulk, training burn reduces the surplus
    const surplusMinusBurn = Math.max(250 - avgDailyPlannedBurn, 0);
    const weeklyGainKg = surplusMinusBurn > 0 ? (surplusMinusBurn * 7) / 7700 : 0;
    if (weightGap < 0 && weeklyGainKg > 0) {
      const weeksEstimate = Math.abs(weightGap) / weeklyGainKg;
      weeksEstimateLow = Math.round(weeksEstimate * 0.8);
      weeksEstimateHigh = Math.round(weeksEstimate * 1.2);
    }
  } else if (goalMode === "custom") {
    // For custom goal, use stored deficit
    const customDeficit = plan.customDeficitKcal ?? 350;
    const totalAvgDailyDeficit = customDeficit + avgDailyPlannedBurn;
    const weeklyChangeKg = (totalAvgDailyDeficit * 7) / 7700;
    if (customDeficit > 0 && weightGap > 0 && weeklyChangeKg > 0) {
      const weeksEst = weightGap / weeklyChangeKg;
      weeksEstimateLow = Math.round(weeksEst * 0.8);
      weeksEstimateHigh = Math.round(weeksEst * 1.2);
    } else if (customDeficit < 0 && weightGap < 0 && weeklyChangeKg < 0) {
      const weeksEst = Math.abs(weightGap) / Math.abs(weeklyChangeKg);
      weeksEstimateLow = Math.round(weeksEst * 0.8);
      weeksEstimateHigh = Math.round(weeksEst * 1.2);
    }
  }

  return { weeksEstimateLow, weeksEstimateHigh };
}

router.get("/plan/active", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = (res.locals["userId"] as number | undefined) ?? req.session.userId;

  const [plan] = await db.select()
    .from(plansTable)
    .where(and(eq(plansTable.userId, userId), eq(plansTable.active, true)))
    .limit(1);

  if (!plan) {
    res.status(404).json({ error: "No active plan found" });
    return;
  }

  const [profile] = await db.select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  // Fetch the first plan ever created (from onboarding) to get the immutable "started weight"
  const [firstPlan] = await db.select({ snapshotWeightKg: plansTable.snapshotWeightKg })
    .from(plansTable)
    .where(eq(plansTable.userId, userId))
    .orderBy(asc(plansTable.version))
    .limit(1);

  const currentWeightKg = profile?.weightKg ?? plan.snapshotWeightKg;
  const startedWeightKg = firstPlan?.snapshotWeightKg ?? plan.snapshotWeightKg;
  const currentTargetKg = profile?.targetWeightKg ?? plan.snapshotTargetWeightKg;

  // Recalculate timeline based on current workout schedule
  const avgDailyPlannedBurn = await getAvgDailyPlannedBurn(userId, currentWeightKg);
  const { weeksEstimateLow, weeksEstimateHigh } = recalculateTimeline(
    plan,
    currentWeightKg,
    currentTargetKg,
    avgDailyPlannedBurn
  );

  res.json({
    id: plan.id,
    version: plan.version,
    phase: plan.phase,
    calorieTarget: plan.calorieTarget,
    proteinG: plan.proteinG,
    carbsG: plan.carbsG,
    fatG: plan.fatG,
    tdeeEstimated: plan.tdeeEstimated,
    deficitSurplusKcal: plan.deficitSurplusKcal,
    bfEstimatePct: plan.bfEstimatePct,
    bfSource: plan.bfSource,
    weeklyExpectedChangeKg: plan.weeklyExpectedChangeKg,
    weeksEstimateLow,
    weeksEstimateHigh,
    summaryText: plan.summaryText,
    goalMode: plan.snapshotGoalMode,
    weightKg: currentWeightKg,
    startedWeightKg,
    targetWeightKg: currentTargetKg,
    trigger: plan.trigger,
    active: plan.active,
    createdAt: plan.createdAt.toISOString(),
    isCustomGoal: plan.isCustomGoal,
    carbsTooLow: (plan.carbsG ?? 0) < 50,
    ...(profile ? {
      profile: {
        id: profile.id,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        targetWeightKg: profile.targetWeightKg,
        age: profile.age,
        gender: profile.gender,
        goalMode: profile.goalMode,
        activityLevel: profile.activityLevel,
        trainingDays: profile.trainingDays,
        trainingLocation: profile.trainingLocation,
        dietaryPreferences: profile.dietaryPreferences as string[],
        injuryFlags: profile.injuryFlags as string[],
        goalOverride: profile.goalOverride,
      },
    } : {}),
  });
});

export default router;
