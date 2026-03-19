import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionCard } from "@/components/OptionCard";
import { ChevronLeft, Check, Loader2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileFormData {
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  age: number;
  activityLevel: string;
  trainingDays: number;
  goalMode: string;
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

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
};

function getCustomWarnings(params: CustomParams): string[] {
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

export default function ProfileEdit() {
  const [, setLocation] = useLocation();
  const { profile, isLoading, updateProfile, useGetAvailableGoals } = useProfile();
  const getGoalsMutation = useGetAvailableGoals();

  const [formData, setFormData] = useState<ProfileFormData | null>(null);
  const [customParams, setCustomParams] = useState<CustomParams>({
    proteinPerKg: "2.2",
    fatPerKg: "1.0",
    deficitKcal: "350",
  });
  const [availableGoals, setAvailableGoals] = useState<GoalOption[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveAnyway, setSaveAnyway] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        targetWeightKg: profile.targetWeightKg,
        age: profile.age,
        activityLevel: profile.activityLevel,
        trainingDays: profile.trainingDays,
        goalMode: profile.goalMode,
      });
      if (profile.goalMode === "custom") {
        setCustomParams({
          proteinPerKg: String(profile.customProteinPerKg ?? "2.2"),
          fatPerKg: String(profile.customFatPerKg ?? "1.0"),
          deficitKcal: String(profile.customDeficitKcal ?? "350"),
        });
      }
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      setGoalsLoading(true);
      getGoalsMutation.mutate(
        { data: { currentWeightKg: profile.weightKg, targetWeightKg: profile.targetWeightKg } },
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
  }, [profile?.id]);

  const customWarnings = useMemo(() => {
    if (!formData || formData.goalMode !== "custom") return [];
    return getCustomWarnings(customParams);
  }, [formData?.goalMode, customParams]);

  const customPreview = useMemo(() => {
    if (!formData || formData.goalMode !== "custom" || !profile) return null;
    const protein = Number(customParams.proteinPerKg);
    const fat = Number(customParams.fatPerKg);
    const deficit = Number(customParams.deficitKcal);
    if (!protein || !fat) return null;
    const bmr = calcBMR(formData.weightKg, formData.heightCm, formData.age, profile.gender);
    const multiplier = ACTIVITY_MULTIPLIERS[formData.activityLevel] ?? 1.375;
    const tdee = bmr * multiplier;
    const calories = Math.max(Math.round(tdee - deficit), 1200);
    const proteinG = Math.round(protein * formData.weightKg);
    const fatG = Math.round(Math.max(fat * formData.weightKg, (calories * 0.20) / 9));
    const carbsG = Math.max(Math.round((calories - proteinG * 4 - fatG * 9) / 4), 0);
    return { calories, proteinG, fatG, carbsG, tdee: Math.round(tdee) };
  }, [formData?.goalMode, formData?.weightKg, formData?.heightCm, formData?.age, formData?.activityLevel, customParams, profile?.gender]);

  if (isLoading || !formData) {
    return (
      <div className="mobile-container flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const hasActiveWarnings = formData.goalMode === "custom" && customWarnings.length > 0;

  const handleSave = (force = false) => {
    if (hasActiveWarnings && !force && !saveAnyway) return;

    const payload: Record<string, unknown> = {
      heightCm: Number(formData.heightCm),
      weightKg: Number(formData.weightKg),
      targetWeightKg: Number(formData.targetWeightKg),
      age: Number(formData.age),
      trainingDays: formData.trainingDays as 3 | 4 | 5 | 6,
      activityLevel: formData.activityLevel as "sedentary" | "lightly_active" | "moderately_active" | "very_active",
      goalMode: formData.goalMode,
    };
    if (formData.goalMode === "custom") {
      payload.customProteinPerKg = Number(customParams.proteinPerKg);
      payload.customFatPerKg = Number(customParams.fatPerKg);
      payload.customDeficitKcal = Number(customParams.deficitKcal);
    }

    updateProfile.mutate(
      { data: payload as Parameters<typeof updateProfile.mutate>[0]["data"] },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => {
            setLocation("/dashboard");
          }, 1500);
        }
      }
    );
  };

  return (
    <div className="mobile-container flex flex-col h-screen overflow-hidden">
      <header className="px-6 py-5 flex items-center gap-4 border-b border-border bg-background z-10">
        <Link href="/dashboard" className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted active:scale-95 transition-all">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="flex-1 text-lg font-semibold tracking-tight text-center pr-10">Edit Profile</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6 pb-40 space-y-8 scrollbar-none">
        {saved && (
          <div className="p-4 bg-primary/20 border border-primary/30 rounded-xl text-primary font-medium flex items-center gap-3">
            <Check className="w-5 h-5" />
            Your plan has been updated! Redirecting...
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Metrics</h2>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Height (cm)</label>
            <Input 
              type="number" 
              value={formData.heightCm} 
              onChange={e => setFormData({...formData, heightCm: Number(e.target.value)})} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Current Weight</label>
              <Input 
                type="number" 
                value={formData.weightKg} 
                onChange={e => setFormData({...formData, weightKg: Number(e.target.value)})} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-primary">Target Weight</label>
              <Input 
                type="number" 
                className="border-primary/50 bg-primary/5"
                value={formData.targetWeightKg} 
                onChange={e => setFormData({...formData, targetWeightKg: Number(e.target.value)})} 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Age</label>
            <Input 
              type="number" 
              value={formData.age} 
              onChange={e => setFormData({...formData, age: Number(e.target.value)})} 
            />
          </div>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lifestyle</h2>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Activity Level</label>
            <select 
              className="flex h-14 w-full rounded-xl border border-card-border bg-input px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={formData.activityLevel}
              onChange={e => setFormData({...formData, activityLevel: e.target.value})}
            >
              <option value="sedentary">Sedentary</option>
              <option value="lightly_active">Lightly Active</option>
              <option value="moderately_active">Moderately Active</option>
              <option value="very_active">Very Active</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Training Days</label>
            <select 
              className="flex h-14 w-full rounded-xl border border-card-border bg-input px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={formData.trainingDays}
              onChange={e => setFormData({...formData, trainingDays: Number(e.target.value)})}
            >
              <option value="3">3 Days</option>
              <option value="4">4 Days</option>
              <option value="5">5 Days</option>
              <option value="6">6 Days</option>
            </select>
          </div>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Goal Mode</h2>

          {goalsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {availableGoals.map(opt => (
                <OptionCard
                  key={opt.mode}
                  title={opt.label}
                  description={opt.description}
                  selected={formData.goalMode === opt.mode}
                  onClick={() => setFormData({ ...formData, goalMode: opt.mode })}
                />
              ))}

              <AnimatePresence>
                {formData.goalMode === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
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
                        <p className="text-xs text-muted-foreground mt-2 text-center">Est. TDEE ~{customPreview.tdee} kcal/day</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 bg-gradient-to-t from-background via-background to-transparent pt-12">
        {hasActiveWarnings && !saveAnyway && (
          <div className="mb-4 space-y-2">
            {customWarnings.map((w, i) => (
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
                onClick={() => setSaveAnyway(false)}
              >
                Adjust values
              </Button>
              <Button
                className="flex-1"
                size="lg"
                onClick={() => { setSaveAnyway(true); handleSave(true); }}
                disabled={updateProfile.isPending || saved}
              >
                {updateProfile.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save anyway"}
              </Button>
            </div>
          </div>
        )}
        {(!hasActiveWarnings || saveAnyway) && (
          <Button 
            className="w-full shadow-2xl" 
            size="lg" 
            onClick={() => handleSave()}
            disabled={updateProfile.isPending || saved}
          >
            {updateProfile.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
          </Button>
        )}
      </div>
    </div>
  );
}
