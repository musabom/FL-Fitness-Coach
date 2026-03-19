import { useState, useEffect, useMemo } from "react";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { OptionCard } from "@/components/OptionCard";
import { ChevronLeft, Loader2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OnboardingFormData {
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  age: string;
  gender: string;
  goalMode: string;
  activityLevel: string;
  trainingDays: string;
  trainingLocation: string;
}

interface CustomParams {
  proteinPerKg: string;
  fatPerKg: string;
  deficitKcal: string;
}

interface GoalOption {
  mode: string;
  label: string;
  description: string;
}

const CUSTOM_GOAL_CARD: GoalOption = {
  mode: "custom",
  label: "Custom Plan",
  description: "Set your own protein, fat, and calorie targets — full control over your nutrition",
};

const SAFE_PROTEIN_MIN = 1.6;
const SAFE_PROTEIN_MAX = 3.5;
const SAFE_FAT_MIN = 0.5;
const SAFE_FAT_MAX = 2.0;
const SAFE_DEFICIT_ABS_MAX = 750;

function calcBMR(weight: number, height: number, age: number, gender: string): number {
  if (gender === "female") return (10 * weight) + (6.25 * height) - (5 * age) - 161;
  return (10 * weight) + (6.25 * height) - (5 * age) + 5;
}

function getCustomWarnings(params: CustomParams, weightKg: number): string[] {
  const warnings: string[] = [];
  const p = Number(params.proteinPerKg);
  const f = Number(params.fatPerKg);
  const d = Number(params.deficitKcal);
  if (params.proteinPerKg && (p < SAFE_PROTEIN_MIN || p > SAFE_PROTEIN_MAX)) {
    warnings.push(`Protein (${p}g/kg) is outside the safe range of ${SAFE_PROTEIN_MIN}–${SAFE_PROTEIN_MAX}g/kg`);
  }
  if (params.fatPerKg && (f < SAFE_FAT_MIN || f > SAFE_FAT_MAX)) {
    warnings.push(`Fat (${f}g/kg) is outside the safe range of ${SAFE_FAT_MIN}–${SAFE_FAT_MAX}g/kg`);
  }
  if (params.deficitKcal && Math.abs(d) > SAFE_DEFICIT_ABS_MAX) {
    const label = d > 0 ? `deficit of ${d} kcal` : `surplus of ${Math.abs(d)} kcal`;
    warnings.push(`Calorie ${label} exceeds the safe limit of ±${SAFE_DEFICIT_ABS_MAX} kcal`);
  }
  return warnings;
}

export default function Onboarding() {
  const { completeOnboarding, useGetAvailableGoals } = useProfile();
  const getGoalsMutation = useGetAvailableGoals();
  
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const [formData, setFormData] = useState<OnboardingFormData>({
    heightCm: "",
    weightKg: "",
    targetWeightKg: "",
    age: "",
    gender: "",
    goalMode: "",
    activityLevel: "",
    trainingDays: "4",
    trainingLocation: "gym",
  });

  const [customParams, setCustomParams] = useState<CustomParams>({
    proteinPerKg: "2.2",
    fatPerKg: "1.0",
    deficitKcal: "350",
  });

  const [preprogrammedDeficitKcal, setPreprogrammedDeficitKcal] = useState("350");

  const [availableGoals, setAvailableGoals] = useState<GoalOption[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [saveAnyway, setSaveAnyway] = useState(false);
  const [touchedCustomFields, setTouchedCustomFields] = useState({ protein: false, fat: false, deficit: false });

  useEffect(() => {
    if (step === 2) {
      setGoalsLoading(true);
      getGoalsMutation.mutate(
        { data: { currentWeightKg: Number(formData.weightKg), targetWeightKg: Number(formData.targetWeightKg) } },
        {
          onSuccess: (res) => {
            setAvailableGoals([...(res.availableGoals as GoalOption[]), CUSTOM_GOAL_CARD]);
            setGoalsLoading(false);
          },
          onError: () => {
            setAvailableGoals([CUSTOM_GOAL_CARD]);
            setGoalsLoading(false);
          }
        }
      );
    }
  }, [step]);

  const customWarnings = useMemo(() => {
    if (formData.goalMode !== "custom") return [];
    return getCustomWarnings(customParams, Number(formData.weightKg));
  }, [formData.goalMode, customParams, formData.weightKg]);

  const visibleWarnings = useMemo(() => {
    if (formData.goalMode !== "custom") return [];
    const warnings: string[] = [];
    const p = Number(customParams.proteinPerKg);
    const f = Number(customParams.fatPerKg);
    const d = Number(customParams.deficitKcal);
    if (touchedCustomFields.protein && customParams.proteinPerKg && (p < SAFE_PROTEIN_MIN || p > SAFE_PROTEIN_MAX)) {
      warnings.push(`Protein (${p}g/kg) is outside the safe range of ${SAFE_PROTEIN_MIN}–${SAFE_PROTEIN_MAX}g/kg`);
    }
    if (touchedCustomFields.fat && customParams.fatPerKg && (f < SAFE_FAT_MIN || f > SAFE_FAT_MAX)) {
      warnings.push(`Fat (${f}g/kg) is outside the safe range of ${SAFE_FAT_MIN}–${SAFE_FAT_MAX}g/kg`);
    }
    if (touchedCustomFields.deficit && customParams.deficitKcal && Math.abs(d) > SAFE_DEFICIT_ABS_MAX) {
      const label = d > 0 ? `deficit of ${d} kcal` : `surplus of ${Math.abs(d)} kcal`;
      warnings.push(`Calorie ${label} exceeds the safe limit of ±${SAFE_DEFICIT_ABS_MAX} kcal`);
    }
    return warnings;
  }, [touchedCustomFields, customParams, formData.goalMode]);

  const customPreview = useMemo(() => {
    if (formData.goalMode !== "custom") return null;
    const weight = Number(formData.weightKg);
    const height = Number(formData.heightCm);
    const age = Number(formData.age);
    const gender = formData.gender;
    const protein = Number(customParams.proteinPerKg);
    const fat = Number(customParams.fatPerKg);
    const deficit = Number(customParams.deficitKcal);
    if (!weight || !height || !age || !gender || !protein || !fat) return null;
    const bmr = calcBMR(weight, height, age, gender);
    const tdee = bmr * 1.375;
    const calories = Math.max(Math.round(tdee - deficit), 1200);
    const proteinG = Math.round(protein * weight);
    const fatG = Math.round(Math.max(fat * weight, (calories * 0.20) / 9));
    const carbsG = Math.max(Math.round((calories - proteinG * 4 - fatG * 9) / 4), 0);
    return { calories, proteinG, fatG, carbsG, tdee: Math.round(tdee) };
  }, [formData.goalMode, customParams, formData.weightKg, formData.heightCm, formData.age, formData.gender]);

  const handleNext = () => {
    if (step === 2 && formData.goalMode === "custom" && customWarnings.length > 0) {
      setTouchedCustomFields({ protein: true, fat: true, deficit: true });
      return;
    }
    if (step < totalSteps) {
      setStep(s => s + 1);
    } else {
      submitForm();
    }
  };

  const submitForm = (forceSubmit = false) => {
    if (formData.goalMode === "custom" && customWarnings.length > 0 && !forceSubmit && !saveAnyway) {
      setSaveAnyway(false);
      return;
    }
    const payload: Record<string, unknown> = {
      heightCm: Number(formData.heightCm),
      weightKg: Number(formData.weightKg),
      targetWeightKg: Number(formData.targetWeightKg),
      age: Number(formData.age),
      gender: formData.gender as "male" | "female" | "prefer_not_to_say",
      goalMode: formData.goalMode as "cut" | "recomposition" | "lean_bulk" | "maintenance" | "custom",
      activityLevel: formData.activityLevel as "sedentary" | "lightly_active" | "moderately_active" | "very_active",
      trainingDays: Number(formData.trainingDays),
      trainingLocation: formData.trainingLocation as "gym" | "home" | "both",
      dietaryPreferences: [],
      injuryFlags: [],
    };
    if (formData.goalMode === "custom") {
      payload.customProteinPerKg = Number(customParams.proteinPerKg);
      payload.customFatPerKg = Number(customParams.fatPerKg);
      payload.customDeficitKcal = Number(customParams.deficitKcal);
    } else {
      payload.customDeficitKcal = Number(preprogrammedDeficitKcal);
    }
    completeOnboarding.mutate({ data: payload as Parameters<typeof completeOnboarding.mutate>[0]["data"] });
  };

  const isStepValid = () => {
    switch (step) {
      case 1: 
        return Number(formData.heightCm) > 0 && 
               Number(formData.weightKg) > 0 && 
               Number(formData.targetWeightKg) > 0 && 
               Number(formData.age) > 0 && 
               formData.gender !== "";
      case 2: {
        if (formData.goalMode !== "custom") return formData.goalMode !== "";
        const p = Number(customParams.proteinPerKg);
        const f = Number(customParams.fatPerKg);
        return formData.goalMode !== "" && p > 0 && f > 0;
      }
      case 3: 
        return formData.activityLevel !== "";
      default: 
        return false;
    }
  };

  const hasActiveWarnings = formData.goalMode === "custom" && visibleWarnings.length > 0 && step === 2;

  const renderStepContent = (): React.ReactNode => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-semibold tracking-tight">Your Body Profile</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2 px-1">Height</label>
                <div className="relative">
                  <Input 
                    type="number" 
                    className="text-2xl h-16 pl-6 pr-20 font-light"
                    placeholder="170"
                    value={formData.heightCm}
                    onChange={e => setFormData({ ...formData, heightCm: e.target.value })}
                    autoFocus
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg text-muted-foreground font-light">cm</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2 px-1">Current Weight</label>
                <div className="relative">
                  <Input 
                    type="number" 
                    className="text-2xl h-16 pl-6 pr-20 font-light"
                    placeholder="80"
                    value={formData.weightKg}
                    onChange={e => setFormData({ ...formData, weightKg: e.target.value })}
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg text-muted-foreground font-light">kg</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2 px-1">Target Weight</label>
                <div className="relative">
                  <Input 
                    type="number" 
                    className="text-2xl h-16 pl-6 pr-20 font-light"
                    placeholder="75"
                    value={formData.targetWeightKg}
                    onChange={e => setFormData({ ...formData, targetWeightKg: e.target.value })}
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg text-muted-foreground font-light">kg</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2 px-1">Age</label>
                <div className="relative">
                  <Input 
                    type="number" 
                    className="text-2xl h-16 pl-6 pr-20 font-light"
                    placeholder="28"
                    value={formData.age}
                    onChange={e => setFormData({ ...formData, age: e.target.value })}
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg text-muted-foreground font-light">years</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-3 px-1">Biological Sex</label>
                <div className="space-y-3">
                  {[
                    { id: "male", label: "Male" },
                    { id: "female", label: "Female" }
                  ].map(opt => (
                    <OptionCard 
                      key={opt.id}
                      title={opt.label}
                      selected={formData.gender === opt.id}
                      onClick={() => setFormData({ ...formData, gender: opt.id })}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight mb-2">What is your goal?</h2>
              <p className="text-muted-foreground">Based on your target weight gap of {Math.abs(Number(formData.weightKg) - Number(formData.targetWeightKg)).toFixed(1)}kg</p>
            </div>
            {goalsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {availableGoals.map(opt => (
                  <OptionCard 
                    key={opt.mode}
                    title={opt.label}
                    description={opt.description}
                    selected={formData.goalMode === opt.mode}
                    onClick={() => {
                      setFormData({ ...formData, goalMode: opt.mode });
                      setPreprogrammedDeficitKcal("350");
                      if (opt.mode !== "custom") setTouchedCustomFields({ protein: false, fat: false, deficit: false });
                    }}
                  />
                ))}

                {formData.goalMode !== "custom" && formData.goalMode && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 mt-2"
                  >
                    <div className="p-4 bg-[#1A1A1A] rounded-2xl border border-border space-y-4">
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Deficit / Surplus</p>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium flex justify-between">
                          <span>Calorie Deficit / Surplus</span>
                          <span className="text-muted-foreground text-xs">+deficit / −surplus</span>
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="50"
                            min="-1500"
                            max="1500"
                            value={preprogrammedDeficitKcal}
                            onChange={e => setPreprogrammedDeficitKcal(e.target.value)}
                            className="pr-16"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kcal</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {formData.goalMode === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 mt-2"
                  >
                    <div className="p-4 bg-[#1A1A1A] rounded-2xl border border-border space-y-4">
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Custom Parameters</p>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium flex justify-between">
                          <span>Protein per kg</span>
                          <span className="text-muted-foreground text-xs">Safe: {SAFE_PROTEIN_MIN}–{SAFE_PROTEIN_MAX}g</span>
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="5"
                            value={customParams.proteinPerKg}
                            onChange={e => setCustomParams({ ...customParams, proteinPerKg: e.target.value })}
                            onBlur={() => setTouchedCustomFields(t => ({ ...t, protein: true }))}
                            className="pr-16"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">g/kg</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium flex justify-between">
                          <span>Fat per kg</span>
                          <span className="text-muted-foreground text-xs">Safe: {SAFE_FAT_MIN}–{SAFE_FAT_MAX}g</span>
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="5"
                            value={customParams.fatPerKg}
                            onChange={e => setCustomParams({ ...customParams, fatPerKg: e.target.value })}
                            onBlur={() => setTouchedCustomFields(t => ({ ...t, fat: true }))}
                            className="pr-16"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">g/kg</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium flex justify-between">
                          <span>Deficit / Surplus</span>
                          <span className="text-muted-foreground text-xs">+deficit / −surplus</span>
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="50"
                            min="-1500"
                            max="1500"
                            value={customParams.deficitKcal}
                            onChange={e => setCustomParams({ ...customParams, deficitKcal: e.target.value })}
                            onBlur={() => setTouchedCustomFields(t => ({ ...t, deficit: true }))}
                            className="pr-16"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kcal</span>
                        </div>
                      </div>
                    </div>

                    {customPreview && (
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Live Preview</p>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <div className="text-lg font-semibold text-primary">{customPreview.calories}</div>
                            <div className="text-xs text-muted-foreground">kcal</div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold">{customPreview.proteinG}g</div>
                            <div className="text-xs text-muted-foreground">protein</div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold">{customPreview.fatG}g</div>
                            <div className="text-xs text-muted-foreground">fat</div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold">{customPreview.carbsG}g</div>
                            <div className="text-xs text-muted-foreground">carbs</div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-center">Est. TDEE ~{customPreview.tdee} kcal (calories will be recalculated after setting activity level)</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">How active are you?</h2>
            <p className="text-muted-foreground">Not including your workouts.</p>
            <div className="space-y-3">
              {[
                { id: "sedentary", label: "Sedentary", desc: "Mostly sitting" },
                { id: "lightly_active", label: "Lightly Active", desc: "On feet occasionally" },
                { id: "moderately_active", label: "Moderately Active", desc: "On feet much of the day" },
                { id: "very_active", label: "Very Active", desc: "Physical job or very active lifestyle" }
              ].map(opt => (
                <OptionCard 
                  key={opt.id}
                  title={opt.label}
                  description={opt.desc}
                  selected={formData.activityLevel === opt.id}
                  onClick={() => setFormData({ ...formData, activityLevel: opt.id })}
                />
              ))}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="mobile-container flex flex-col h-screen overflow-hidden">
      <header className="px-6 py-6 flex items-center gap-4">
        {step > 1 ? (
          <button 
            onClick={() => setStep(s => s - 1)}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}
        <div className="flex-1">
          <Progress value={(step / totalSteps) * 100} />
        </div>
        <div className="w-10 text-right text-sm font-medium text-muted-foreground">
          {step}/{totalSteps}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-24 scrollbar-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pt-4"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 bg-gradient-to-t from-background via-background to-transparent pt-12">
        {hasActiveWarnings && !saveAnyway && (
          <div className="mb-4 space-y-2">
            {visibleWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
            <div className="flex gap-3 mt-3">
              <Button
                variant="outline"
                className="flex-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                size="lg"
                onClick={() => setTouchedCustomFields({ protein: false, fat: false, deficit: false })}
              >
                Adjust values
              </Button>
              <Button
                className="flex-1"
                size="lg"
                onClick={() => { setSaveAnyway(true); setStep(s => s + 1); }}
                disabled={completeOnboarding.isPending}
              >
                Continue anyway
              </Button>
            </div>
          </div>
        )}
        {(!hasActiveWarnings || saveAnyway) && (
          <Button 
            className="w-full shadow-2xl" 
            size="lg" 
            onClick={handleNext}
            disabled={!isStepValid() || completeOnboarding.isPending}
          >
            {completeOnboarding.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Generating...
              </span>
            ) : step === totalSteps ? "Generate Plan" : "Continue"}
          </Button>
        )}
      </div>
    </div>
  );
}
