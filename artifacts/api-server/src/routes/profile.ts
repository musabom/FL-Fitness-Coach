import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, userProfilesTable, plansTable } from "@workspace/db";
import {
  CompleteOnboardingBody,
  UpdateProfileBody,
} from "@workspace/api-zod";
import { calculatePlan } from "../lib/plan-calculator";

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
  return req.session.userId;
}

router.post("/onboarding", async (req, res): Promise<void> => {
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

  const [profile] = await db.insert(userProfilesTable).values({
    userId,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    targetWeightKg: data.targetWeightKg,
    age: data.age,
    gender: data.gender,
    goalMode: data.goalMode,
    activityLevel: data.activityLevel,
    trainingDays: data.trainingDays,
    trainingLocation: data.trainingLocation,
    dietaryPreferences: data.dietaryPreferences,
    injuryFlags: data.injuryFlags,
    goalOverride: data.goalOverride ?? false,
  }).returning();

  const planResult = calculatePlan({
    weightKg: data.weightKg,
    targetWeightKg: data.targetWeightKg,
    heightCm: data.heightCm,
    age: data.age,
    gender: data.gender,
    goalMode: data.goalMode,
    activityLevel: data.activityLevel,
  });

  const [plan] = await db.insert(plansTable).values({
    userId,
    version: 1,
    phase: data.goalMode,
    calorieTarget: planResult.calorieTarget,
    proteinG: planResult.proteinG,
    carbsG: planResult.carbsG,
    fatG: planResult.fatG,
    tdeeEstimated: planResult.tdeeEstimated,
    deficitSurplusKcal: planResult.deficitSurplusKcal,
    bfEstimatePct: planResult.bfEstimatePct,
    bfSource: planResult.bfSource,
    trigger: "onboarding",
    active: true,
  }).returning();

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
    goalMode: data.goalMode,
    weightKg: data.weightKg,
    targetWeightKg: data.targetWeightKg,
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

  const [updatedProfile] = await db.update(userProfilesTable)
    .set(updateData)
    .where(eq(userProfilesTable.userId, userId))
    .returning();

  await db.update(plansTable)
    .set({ active: false })
    .where(and(eq(plansTable.userId, userId), eq(plansTable.active, true)));

  const [latestPlan] = await db.select()
    .from(plansTable)
    .where(eq(plansTable.userId, userId))
    .orderBy(desc(plansTable.version))
    .limit(1);

  const newVersion = latestPlan ? latestPlan.version + 1 : 1;

  const planResult = calculatePlan({
    weightKg: updatedProfile.weightKg,
    targetWeightKg: updatedProfile.targetWeightKg,
    heightCm: updatedProfile.heightCm,
    age: updatedProfile.age,
    gender: updatedProfile.gender,
    goalMode: updatedProfile.goalMode,
    activityLevel: updatedProfile.activityLevel,
  });

  const [newPlan] = await db.insert(plansTable).values({
    userId,
    version: newVersion,
    phase: updatedProfile.goalMode,
    calorieTarget: planResult.calorieTarget,
    proteinG: planResult.proteinG,
    carbsG: planResult.carbsG,
    fatG: planResult.fatG,
    tdeeEstimated: planResult.tdeeEstimated,
    deficitSurplusKcal: planResult.deficitSurplusKcal,
    bfEstimatePct: planResult.bfEstimatePct,
    bfSource: planResult.bfSource,
    trigger: "manual_edit",
    active: true,
  }).returning();

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
    goalMode: updatedProfile.goalMode,
    weightKg: updatedProfile.weightKg,
    targetWeightKg: updatedProfile.targetWeightKg,
    weeklyExpectedChangeKg: planResult.weeklyExpectedChangeKg,
    weeksEstimateLow: planResult.weeksEstimateLow,
    weeksEstimateHigh: planResult.weeksEstimateHigh,
    summaryText: planResult.summaryText,
    trigger: newPlan.trigger,
    active: newPlan.active,
    createdAt: newPlan.createdAt.toISOString(),
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
    },
  });
});

export default router;
