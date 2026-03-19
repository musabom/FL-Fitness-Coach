import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, plansTable, userProfilesTable } from "@workspace/db";

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

  // Fetch the first plan ever created (from onboarding) to get the immutable "started weight"
  const [firstPlan] = await db.select({ snapshotWeightKg: plansTable.snapshotWeightKg })
    .from(plansTable)
    .where(eq(plansTable.userId, userId))
    .orderBy(asc(plansTable.version))
    .limit(1);

  const currentWeightKg = profile?.weightKg ?? plan.snapshotWeightKg;
  const startedWeightKg = firstPlan?.snapshotWeightKg ?? plan.snapshotWeightKg;
  const currentTargetKg = profile?.targetWeightKg ?? plan.snapshotTargetWeightKg;

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
    weeksEstimateLow: plan.weeksEstimateLow,
    weeksEstimateHigh: plan.weeksEstimateHigh,
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
