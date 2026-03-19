import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, userProfilesTable, plansTable } from "@workspace/db";
import { pool } from "@workspace/db";
import {
  CompleteOnboardingBody,
  UpdateProfileBody,
} from "@workspace/api-zod";
import { calculatePlan, getAvailableGoals } from "../lib/plan-calculator";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

function requireAuth(req: import("express").Request, res: import("express").Response): number | null {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return (res.locals["userId"] as number | undefined) ?? req.session.userId;
}

function validateGoalMode(currentWeightKg: number, targetWeightKg: number, goalMode: string, goalOverride: boolean): string | null {
  if (goalOverride) return null;
  if (goalMode === "custom") return null;
  const { availableGoals, validationError } = getAvailableGoals(currentWeightKg, targetWeightKg);
  if (validationError) return validationError;
  const allowed = availableGoals.map(g => g.mode);
  if (!allowed.includes(goalMode)) {
    return `Goal mode "${goalMode}" is not available for your current weight gap. Available: ${allowed.join(", ")}`;
  }
  return null;
}

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

async function getAvgDailyPlannedBurn(userId: number, weightKg: number): Promise<number> {
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
      estimated_calories = estimateCardioCalories(Number(row.met_value) || 5, Number(row.duration_mins) || 0, weightKg);
    } else {
      estimated_calories = estimateStrengthCalories(Number(row.sets), Number(row.reps_min), Number(row.reps_max), Number(row.rest_seconds), weightKg, row.effort_level || "moderate");
    }
    calorisByDay[day] = (calorisByDay[day] || 0) + estimated_calories;
  }

  // Calculate average across 7 days
  const daysWithWorkouts = Object.values(calorisByDay);
  const totalCalories = daysWithWorkouts.reduce((sum, cal) => sum + cal, 0);
  return daysWithWorkouts.length > 0 ? Math.round(totalCalories / 7) : 0;
}

function buildPlanInsertValues(
  userId: number,
  version: number,
  profileData: {
    weightKg: number;
    targetWeightKg: number;
    heightCm: number;
    age: number;
    gender: string;
    goalMode: string;
    activityLevel: string;
    customParams?: { proteinPerKg: number; fatPerKg: number; deficitKcal: number };
  },
  trigger: "onboarding" | "manual_edit" | "weight_update" | "checkin_adjustment",
  avgDailyPlannedBurn: number = 0
) {
  const planResult = calculatePlan({
    weightKg: profileData.weightKg,
    targetWeightKg: profileData.targetWeightKg,
    heightCm: profileData.heightCm,
    age: profileData.age,
    gender: profileData.gender,
    goalMode: profileData.goalMode,
    activityLevel: profileData.activityLevel,
    customParams: profileData.customParams,
    avgDailyPlannedBurn,
  });
  return {
    planValues: {
      userId,
      version,
      phase: profileData.goalMode,
      calorieTarget: planResult.calorieTarget,
      proteinG: planResult.proteinG,
      carbsG: planResult.carbsG,
      fatG: planResult.fatG,
      tdeeEstimated: planResult.tdeeEstimated,
      deficitSurplusKcal: planResult.deficitSurplusKcal,
      bfEstimatePct: planResult.bfEstimatePct,
      bfSource: planResult.bfSource,
      weeklyExpectedChangeKg: planResult.weeklyExpectedChangeKg,
      weeksEstimateLow: planResult.weeksEstimateLow,
      weeksEstimateHigh: planResult.weeksEstimateHigh,
      summaryText: planResult.summaryText,
      snapshotWeightKg: profileData.weightKg,
      snapshotTargetWeightKg: profileData.targetWeightKg,
      snapshotGoalMode: profileData.goalMode,
      snapshotActivityLevel: profileData.activityLevel,
      snapshotHeightCm: profileData.heightCm,
      snapshotAge: profileData.age,
      snapshotGender: profileData.gender,
      isCustomGoal: planResult.isCustomGoal,
      customProteinRate: planResult.customProteinRate,
      customFatRate: planResult.customFatRate,
      customDeficitKcal: planResult.customDeficitKcal,
      trigger,
      active: true,
    },
    planResult,
  };
}

router.post("/onboarding", async (req, res): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const parsed = CompleteOnboardingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const existing = await db.select({ id: userProfilesTable.id }).from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
    if (existing.length > 0) {
      res.status(400).json({ error: "Profile already exists. Use PATCH /api/profile to update." });
      return;
    }

    const data = parsed.data;

    const goalError = validateGoalMode(data.weightKg, data.targetWeightKg, data.goalMode, data.goalOverride ?? false);
    if (goalError) {
      res.status(400).json({ error: goalError });
      return;
    }

    if (data.goalMode === "custom" && (!data.customProteinPerKg || !data.customFatPerKg || data.customDeficitKcal === undefined)) {
      res.status(400).json({ error: "Custom goal mode requires customProteinPerKg, customFatPerKg, and customDeficitKcal" });
      return;
    }

    const [profile] = await db.insert(userProfilesTable).values({
      userId,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      targetWeightKg: data.targetWeightKg,
      age: data.age,
      gender: data.gender as "male" | "female" | "prefer_not_to_say",
      goalMode: data.goalMode as "cut" | "recomposition" | "lean_bulk" | "maintenance" | "custom",
      activityLevel: data.activityLevel as "sedentary" | "lightly_active" | "moderately_active" | "very_active",
      trainingDays: data.trainingDays,
      trainingLocation: data.trainingLocation as "gym" | "home" | "both",
      dietaryPreferences: data.dietaryPreferences,
      injuryFlags: data.injuryFlags,
      goalOverride: data.goalOverride ?? false,
      customProteinPerKg: data.goalMode === "custom" ? (data.customProteinPerKg ?? null) : null,
      customFatPerKg: data.goalMode === "custom" ? (data.customFatPerKg ?? null) : null,
      customDeficitKcal: data.goalMode === "custom" ? (data.customDeficitKcal ?? null) : null,
    }).returning();

    const customParams = data.goalMode === "custom" && data.customProteinPerKg && data.customFatPerKg && data.customDeficitKcal !== undefined
      ? { proteinPerKg: data.customProteinPerKg, fatPerKg: data.customFatPerKg, deficitKcal: data.customDeficitKcal }
      : undefined;

    const avgDailyPlannedBurn = await getAvgDailyPlannedBurn(userId, data.weightKg);

    const { planValues, planResult } = buildPlanInsertValues(
      userId, 1,
      {
        weightKg: data.weightKg,
        targetWeightKg: data.targetWeightKg,
        heightCm: data.heightCm,
        age: data.age,
        gender: data.gender,
        goalMode: data.goalMode,
        activityLevel: data.activityLevel,
        customParams,
      },
      "onboarding",
      avgDailyPlannedBurn
    );

    const [plan] = await db.insert(plansTable).values(planValues).returning();

    res.status(201).json({
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
      goalMode: plan.snapshotGoalMode,
      weightKg: plan.snapshotWeightKg,
      targetWeightKg: plan.snapshotTargetWeightKg,
      weeklyExpectedChangeKg: plan.weeklyExpectedChangeKg,
      weeksEstimateLow: plan.weeksEstimateLow,
      weeksEstimateHigh: plan.weeksEstimateHigh,
      summaryText: plan.summaryText,
      trigger: plan.trigger,
      active: plan.active,
      createdAt: plan.createdAt.toISOString(),
      isCustomGoal: plan.isCustomGoal,
      carbsTooLow: (plan.carbsG ?? 0) < 50,
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
        customProteinPerKg: profile.customProteinPerKg,
        customFatPerKg: profile.customFatPerKg,
        customDeficitKcal: profile.customDeficitKcal,
      },
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ error: "Failed to generate plan: " + (error instanceof Error ? error.message : "Unknown error") });
  }
});

router.get("/profile", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json({
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
    customProteinPerKg: profile.customProteinPerKg,
    customFatPerKg: profile.customFatPerKg,
    customDeficitKcal: profile.customDeficitKcal,
  });
});

router.patch("/profile", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [existingProfile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!existingProfile) {
    res.status(404).json({ error: "Profile not found. Complete onboarding first." });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.heightCm !== undefined) updateData.heightCm = d.heightCm;
  if (d.weightKg !== undefined) updateData.weightKg = d.weightKg;
  if (d.targetWeightKg !== undefined) updateData.targetWeightKg = d.targetWeightKg;
  if (d.age !== undefined) updateData.age = d.age;
  if (d.gender !== undefined) updateData.gender = d.gender;
  if (d.goalMode !== undefined) updateData.goalMode = d.goalMode;
  if (d.activityLevel !== undefined) updateData.activityLevel = d.activityLevel;
  if (d.trainingDays !== undefined) updateData.trainingDays = d.trainingDays;
  if (d.trainingLocation !== undefined) updateData.trainingLocation = d.trainingLocation;
  if (d.dietaryPreferences !== undefined) updateData.dietaryPreferences = d.dietaryPreferences;
  if (d.injuryFlags !== undefined) updateData.injuryFlags = d.injuryFlags;
  if (d.goalOverride !== undefined) updateData.goalOverride = d.goalOverride;

  const mergedWeight = d.weightKg ?? existingProfile.weightKg;
  const mergedTarget = d.targetWeightKg ?? existingProfile.targetWeightKg;
  const mergedGoal = d.goalMode ?? existingProfile.goalMode;
  const mergedOverride = d.goalOverride ?? existingProfile.goalOverride;

  const goalError = validateGoalMode(mergedWeight, mergedTarget, mergedGoal, mergedOverride);
  if (goalError) {
    res.status(400).json({ error: goalError });
    return;
  }

  if (mergedGoal === "custom") {
    if (d.customProteinPerKg !== undefined) updateData.customProteinPerKg = d.customProteinPerKg;
    if (d.customFatPerKg !== undefined) updateData.customFatPerKg = d.customFatPerKg;
    if (d.customDeficitKcal !== undefined) updateData.customDeficitKcal = d.customDeficitKcal;

    const resolvedProtein = d.customProteinPerKg ?? existingProfile.customProteinPerKg;
    const resolvedFat = d.customFatPerKg ?? existingProfile.customFatPerKg;
    if (!resolvedProtein || !resolvedFat) {
      res.status(400).json({ error: "Custom goal mode requires customProteinPerKg and customFatPerKg" });
      return;
    }
  }

  const previousWeight = existingProfile.weightKg;

  const result = await db.transaction(async (tx) => {
    const [updatedProfile] = await tx.update(userProfilesTable)
      .set(updateData)
      .where(eq(userProfilesTable.userId, userId))
      .returning();

    await tx.update(plansTable)
      .set({ active: false })
      .where(and(eq(plansTable.userId, userId), eq(plansTable.active, true)));

    const [latestPlan] = await tx.select()
      .from(plansTable)
      .where(eq(plansTable.userId, userId))
      .orderBy(desc(plansTable.version))
      .limit(1);

    const newVersion = latestPlan ? latestPlan.version + 1 : 1;

    const effectiveGoal = updatedProfile.goalMode;
    let customParams: { proteinPerKg: number; fatPerKg: number; deficitKcal: number } | undefined;

    if (effectiveGoal === "custom") {
      const storedProtein = updatedProfile.customProteinPerKg ?? 2.2;
      const storedFat = updatedProfile.customFatPerKg ?? 1.0;
      const storedDeficit = updatedProfile.customDeficitKcal ?? 350;
      customParams = { proteinPerKg: storedProtein, fatPerKg: storedFat, deficitKcal: storedDeficit };
    }

    const avgDailyPlannedBurn = await getAvgDailyPlannedBurn(userId, updatedProfile.weightKg);

    const { planValues } = buildPlanInsertValues(
      userId, newVersion,
      {
        weightKg: updatedProfile.weightKg,
        targetWeightKg: updatedProfile.targetWeightKg,
        heightCm: updatedProfile.heightCm,
        age: updatedProfile.age,
        gender: updatedProfile.gender,
        goalMode: updatedProfile.goalMode,
        activityLevel: updatedProfile.activityLevel,
        customParams,
      },
      "manual_edit",
      avgDailyPlannedBurn
    );

    const [newPlan] = await tx.insert(plansTable).values(planValues).returning();

    return { updatedProfile, newPlan };
  });

  const { updatedProfile, newPlan } = result;

  // Record weight in history if it changed
  if (d.weightKg !== undefined && d.weightKg !== previousWeight) {
    await pool.query(
      `INSERT INTO weight_history (user_id, weight_kg) VALUES ($1, $2)`,
      [userId, d.weightKg]
    );
  }

  res.json({
    id: newPlan.id,
    version: newPlan.version,
    phase: newPlan.phase,
    calorieTarget: newPlan.calorieTarget,
    proteinG: newPlan.proteinG,
    carbsG: newPlan.carbsG,
    fatG: newPlan.fatG,
    tdeeEstimated: newPlan.tdeeEstimated,
    deficitSurplusKcal: newPlan.deficitSurplusKcal,
    bfEstimatePct: newPlan.bfEstimatePct,
    bfSource: newPlan.bfSource,
    goalMode: newPlan.snapshotGoalMode,
    weightKg: newPlan.snapshotWeightKg,
    targetWeightKg: newPlan.snapshotTargetWeightKg,
    weeklyExpectedChangeKg: newPlan.weeklyExpectedChangeKg,
    weeksEstimateLow: newPlan.weeksEstimateLow,
    weeksEstimateHigh: newPlan.weeksEstimateHigh,
    summaryText: newPlan.summaryText,
    trigger: newPlan.trigger,
    active: newPlan.active,
    createdAt: newPlan.createdAt.toISOString(),
    isCustomGoal: newPlan.isCustomGoal,
    carbsTooLow: (newPlan.carbsG ?? 0) < 50,
    profile: {
      id: updatedProfile.id,
      heightCm: updatedProfile.heightCm,
      weightKg: updatedProfile.weightKg,
      targetWeightKg: updatedProfile.targetWeightKg,
      age: updatedProfile.age,
      gender: updatedProfile.gender,
      goalMode: updatedProfile.goalMode,
      activityLevel: updatedProfile.activityLevel,
      trainingDays: updatedProfile.trainingDays,
      trainingLocation: updatedProfile.trainingLocation,
      dietaryPreferences: updatedProfile.dietaryPreferences as string[],
      injuryFlags: updatedProfile.injuryFlags as string[],
      goalOverride: updatedProfile.goalOverride,
      customProteinPerKg: updatedProfile.customProteinPerKg,
      customFatPerKg: updatedProfile.customFatPerKg,
      customDeficitKcal: updatedProfile.customDeficitKcal,
    },
  });
});

export default router;
