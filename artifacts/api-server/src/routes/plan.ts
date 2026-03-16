import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, plansTable } from "@workspace/db";

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
    weightKg: plan.snapshotWeightKg,
    targetWeightKg: plan.snapshotTargetWeightKg,
    trigger: plan.trigger,
    active: plan.active,
    createdAt: plan.createdAt.toISOString(),
    profile: {
      heightCm: plan.snapshotHeightCm,
      weightKg: plan.snapshotWeightKg,
      targetWeightKg: plan.snapshotTargetWeightKg,
      age: plan.snapshotAge,
      gender: plan.snapshotGender,
      goalMode: plan.snapshotGoalMode,
      activityLevel: plan.snapshotActivityLevel,
    },
  });
});

export default router;
