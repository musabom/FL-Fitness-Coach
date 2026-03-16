import { Router, type IRouter } from "express";
import { GetAvailableGoalsBody } from "@workspace/api-zod";
import { getAvailableGoals } from "../lib/plan-calculator";

const router: IRouter = Router();

router.post("/goals/available", async (req, res): Promise<void> => {
  const parsed = GetAvailableGoalsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const result = getAvailableGoals(parsed.data.currentWeightKg, parsed.data.targetWeightKg);
  res.json(result);
});

export default router;
