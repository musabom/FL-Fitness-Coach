interface CustomParams {
  proteinPerKg: number;
  fatPerKg: number;
  deficitKcal: number;
}

interface PlanInput {
  weightKg: number;
  targetWeightKg: number;
  heightCm: number;
  age: number;
  gender: string;
  goalMode: string;
  activityLevel: string;
  customParams?: CustomParams;
}

interface PlanResult {
  calorieTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  tdeeEstimated: number;
  deficitSurplusKcal: number;
  bfEstimatePct: number;
  bfSource: string;
  weeklyExpectedChangeKg: number;
  weeksEstimateLow: number | null;
  weeksEstimateHigh: number | null;
  summaryText: string;
  isCustomGoal: boolean;
  customProteinRate: number | null;
  customFatRate: number | null;
  customDeficitKcal: number | null;
}

function calcBMR(weightKg: number, heightCm: number, age: number, gender: string): number {
  if (gender === "female") {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  }
  return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
}

function calcTDEE(bmr: number, activityLevel: string): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
  };
  return bmr * (multipliers[activityLevel] ?? 1.2);
}

function calcBFProxy(weightKg: number, heightCm: number, age: number, gender: string): number {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const sexFactor = gender === "male" ? 1 : 0;
  return (1.20 * bmi) + (0.23 * age) - (10.8 * sexFactor) - 5.4;
}

function calcDeficit(goalMode: string, bfPct: number, gender: string, weightKg: number): number {
  if (goalMode === "maintenance") return 0;
  if (goalMode === "lean_bulk") return -250;

  let deficit: number;
  if (gender === "male" || gender === "prefer_not_to_say") {
    if (bfPct > 25) deficit = 500;
    else if (bfPct >= 15) deficit = 350;
    else deficit = 200;
  } else {
    if (bfPct > 33) deficit = 500;
    else if (bfPct >= 22) deficit = 350;
    else deficit = 200;
  }

  const fatMassKg = weightKg * (bfPct / 100);
  const maxDeficit = fatMassKg * 22 * 2.2;
  deficit = Math.min(deficit, maxDeficit);

  return deficit;
}

function calcMacros(weightKg: number, age: number, goalMode: string, calorieTarget: number) {
  let proteinG: number;

  if (age > 50) {
    proteinG = Math.round(weightKg * 2.4);
  } else if (goalMode === "cut" || goalMode === "recomposition") {
    proteinG = Math.round(weightKg * 2.2);
  } else if (goalMode === "lean_bulk") {
    proteinG = Math.round(weightKg * 1.8);
  } else {
    proteinG = Math.round(weightKg * 1.6);
  }

  const fatG = Math.round(Math.max(weightKg * 0.7, (calorieTarget * 0.20) / 9));

  let carbsG = Math.round((calorieTarget - (proteinG * 4) - (fatG * 9)) / 4);
  if (carbsG < 0) carbsG = 0;

  return { proteinG, fatG, carbsG };
}

export function goalLabel(goalMode: string): string {
  const labels: Record<string, string> = {
    cut: "Lose fat and preserve muscle",
    recomposition: "Lose fat and build muscle simultaneously",
    lean_bulk: "Build muscle with minimal fat gain",
    maintenance: "Maintain your current weight and composition",
    custom: "Custom nutrition plan",
  };
  return labels[goalMode] ?? goalMode;
}

export function calculatePlan(input: PlanInput): PlanResult {
  const { weightKg, targetWeightKg, heightCm, age, gender, goalMode, activityLevel, customParams } = input;

  const bmr = calcBMR(weightKg, heightCm, age, gender);
  const tdee = calcTDEE(bmr, activityLevel);
  const bfPct = calcBFProxy(weightKg, heightCm, age, gender);

  if (goalMode === "custom" && customParams) {
    const { proteinPerKg, fatPerKg, deficitKcal } = customParams;
    const calorieTarget = Math.max(Math.round(tdee - deficitKcal), 1200);
    const proteinG = Math.round(proteinPerKg * weightKg);
    const fatG = Math.round(Math.max(fatPerKg * weightKg, (calorieTarget * 0.20) / 9));
    let carbsG = Math.round((calorieTarget - (proteinG * 4) - (fatG * 9)) / 4);
    if (carbsG < 0) carbsG = 0;

    const weeklyChangeKg = (deficitKcal * 7) / 7700;
    const weightGap = weightKg - targetWeightKg;
    let weeksEstimateLow: number | null = null;
    let weeksEstimateHigh: number | null = null;
    if (deficitKcal > 0 && weightGap > 0 && weeklyChangeKg > 0) {
      const weeksEst = weightGap / weeklyChangeKg;
      weeksEstimateLow = Math.round(weeksEst * 0.8);
      weeksEstimateHigh = Math.round(weeksEst * 1.2);
    } else if (deficitKcal < 0 && weightGap < 0 && weeklyChangeKg < 0) {
      const weeksEst = Math.abs(weightGap) / Math.abs(weeklyChangeKg);
      weeksEstimateLow = Math.round(weeksEst * 0.8);
      weeksEstimateHigh = Math.round(weeksEst * 1.2);
    }

    const tdeeRounded = Math.round(tdee);
    const surplusDeficitDesc = deficitKcal > 0
      ? `a deficit of ${deficitKcal} calories`
      : deficitKcal < 0
        ? `a surplus of ${Math.abs(deficitKcal)} calories`
        : "matching your maintenance";
    const summaryText = `Based on your stats, your body burns approximately ${tdeeRounded} calories per day. You've set a custom plan at ${calorieTarget} calories — ${surplusDeficitDesc}. Protein is set at ${proteinG}g (${proteinPerKg}g/kg) and fat at ${fatG}g.`;

    return {
      calorieTarget,
      proteinG,
      carbsG,
      fatG,
      tdeeEstimated: tdeeRounded,
      deficitSurplusKcal: -deficitKcal,
      bfEstimatePct: Math.round(bfPct * 10) / 10,
      bfSource: "proxy_deurenberg",
      weeklyExpectedChangeKg: Math.round(-weeklyChangeKg * 1000) / 1000,
      weeksEstimateLow,
      weeksEstimateHigh,
      summaryText,
      isCustomGoal: true,
      customProteinRate: proteinPerKg,
      customFatRate: fatPerKg,
      customDeficitKcal: deficitKcal,
    };
  }

  const deficitRaw = calcDeficit(goalMode, bfPct, gender, weightKg);

  let deficitSurplusKcal: number;
  let calorieTarget: number;

  if (goalMode === "lean_bulk") {
    deficitSurplusKcal = 250;
    calorieTarget = Math.round(tdee + 250);
  } else if (goalMode === "maintenance") {
    deficitSurplusKcal = 0;
    calorieTarget = Math.round(tdee);
  } else {
    deficitSurplusKcal = -deficitRaw;
    calorieTarget = Math.round(tdee - deficitRaw);
  }

  const { proteinG, fatG, carbsG } = calcMacros(weightKg, age, goalMode, calorieTarget);

  const weightGap = weightKg - targetWeightKg;
  let weeklyExpectedChangeKg = 0;
  let weeksEstimateLow: number | null = null;
  let weeksEstimateHigh: number | null = null;

  if (goalMode === "cut" || goalMode === "recomposition") {
    const weeklyLossKg = (deficitRaw * 7) / 7700;
    weeklyExpectedChangeKg = -weeklyLossKg;
    if (weightGap > 0 && weeklyLossKg > 0) {
      const weeksEstimate = weightGap / weeklyLossKg;
      weeksEstimateLow = Math.round(weeksEstimate * 0.8);
      weeksEstimateHigh = Math.round(weeksEstimate * 1.2);
    }
  } else if (goalMode === "lean_bulk") {
    const weeklyGainKg = (250 * 7) / 7700;
    weeklyExpectedChangeKg = weeklyGainKg;
    if (weightGap < 0) {
      const weeksEstimate = Math.abs(weightGap) / weeklyGainKg;
      weeksEstimateLow = Math.round(weeksEstimate * 0.8);
      weeksEstimateHigh = Math.round(weeksEstimate * 1.2);
    }
  }

  let summaryText = "";
  const tdeeRounded = Math.round(tdee);

  if (goalMode === "cut") {
    summaryText = `Based on your stats, your body burns approximately ${tdeeRounded} calories per day. We've set you at ${calorieTarget} calories — a controlled deficit of ${deficitRaw} calories to lose fat while preserving your muscle mass. Your protein is set high at ${proteinG}g to protect muscle during the deficit.`;
  } else if (goalMode === "recomposition") {
    summaryText = `Based on your stats, your body burns approximately ${tdeeRounded} calories per day. We've set you at ${calorieTarget} calories — a moderate deficit of ${deficitRaw} calories designed to lose fat while building muscle. Your protein is set high at ${proteinG}g to fuel muscle growth even in a deficit. Your weight may not change much — recomposition replaces fat with muscle. Track how your clothes fit and waist measurements, not just the scale.`;
  } else if (goalMode === "lean_bulk") {
    summaryText = `Based on your stats, your body burns approximately ${tdeeRounded} calories per day. We've set you at ${calorieTarget} calories — a controlled surplus of 250 calories to build muscle with minimal fat gain. Your protein is set at ${proteinG}g to maximise muscle protein synthesis.`;
  } else {
    summaryText = `Based on your stats, your body burns approximately ${tdeeRounded} calories per day. We've matched your intake to your expenditure at ${calorieTarget} calories to maintain your current weight and body composition. Your protein is set at ${proteinG}g to support your training and daily recovery.`;
  }

  return {
    calorieTarget,
    proteinG,
    carbsG,
    fatG,
    tdeeEstimated: Math.round(tdee),
    deficitSurplusKcal,
    bfEstimatePct: Math.round(bfPct * 10) / 10,
    bfSource: "proxy_deurenberg",
    weeklyExpectedChangeKg: Math.round(weeklyExpectedChangeKg * 1000) / 1000,
    weeksEstimateLow,
    weeksEstimateHigh,
    summaryText,
    isCustomGoal: false,
    customProteinRate: null,
    customFatRate: null,
    customDeficitKcal: null,
  };
}

export function getAvailableGoals(currentWeightKg: number, targetWeightKg: number) {
  const weightGap = currentWeightKg - targetWeightKg;

  if (targetWeightKg <= 0) {
    return { availableGoals: [], weightGap, validationError: "Target weight must be greater than 0" };
  }
  if (targetWeightKg > currentWeightKg + 30) {
    return { availableGoals: [], weightGap, validationError: "Target weight is unrealistically high — maximum 30kg above current weight" };
  }
  if (targetWeightKg < currentWeightKg - 60) {
    return { availableGoals: [], weightGap, validationError: "Target weight is unrealistically low — maximum 60kg below current weight" };
  }

  const allGoals = [
    { mode: "recomposition", label: "Body Recomposition", description: "Lose fat and build muscle simultaneously — ideal for most people starting out" },
    { mode: "cut", label: "Fat Loss", description: "Focused fat loss while preserving as much muscle as possible" },
    { mode: "lean_bulk", label: "Lean Bulk", description: "Build muscle with a controlled calorie surplus — minimal fat gain" },
    { mode: "maintenance", label: "Maintenance", description: "Maintain your current weight and body composition" },
  ];

  let availableModes: string[];

  if (weightGap > 5) {
    availableModes = ["recomposition", "cut"];
  } else if (weightGap >= 2 && weightGap <= 5) {
    availableModes = ["recomposition", "cut", "maintenance"];
  } else if (weightGap >= -1 && weightGap < 2) {
    availableModes = ["recomposition", "cut", "lean_bulk", "maintenance"];
  } else {
    availableModes = ["lean_bulk", "recomposition", "maintenance"];
  }

  const availableGoals = allGoals.filter(g => availableModes.includes(g.mode));

  return { availableGoals, weightGap, validationError: null };
}
