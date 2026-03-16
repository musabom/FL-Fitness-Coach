import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, plansTable, userProfilesTable } from "@workspace/db";
import { calculatePlan } from "../lib/plan-calculator";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

router.get("/plan/active", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = req.session.userId;

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

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const planResult = calculatePlan({
    weightKg: profile.weightKg,
    targetWeightKg: profile.targetWeightKg,
    heightCm: profile.heightCm,
    age: profile.age,
    gender: profile.gender,
    goalMode: profile.goalMode,
    activityLevel: profile.activityLevel,
  });

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
    goalMode: profile.goalMode,
    weightKg: profile.weightKg,
    targetWeightKg: profile.targetWeightKg,
    weeklyExpectedChangeKg: planResult.weeklyExpectedChangeKg,
    weeksEstimateLow: planResult.weeksEstimateLow,
    weeksEstimateHigh: planResult.weeksEstimateHigh,
    summaryText: planResult.summaryText,
    trigger: plan.trigger,
    active: plan.active,
    createdAt: plan.createdAt.toISOString(),
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
  });
});

export default router;
