import { useState, useEffect } from "react";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { OptionCard } from "@/components/OptionCard";
import { ChevronLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OnboardingFormData {
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  age: string;
  gender: string;
  goalMode: string;
  activityLevel: string;
}

interface GoalOption {
  mode: string;
  label: string;
  description: string;
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
  });

  const [availableGoals, setAvailableGoals] = useState<GoalOption[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);

  useEffect(() => {
    if (step === 2) {
      setGoalsLoading(true);
      getGoalsMutation.mutate(
        { data: { currentWeightKg: Number(formData.weightKg), targetWeightKg: Number(formData.targetWeightKg) } },
        {
          onSuccess: (res) => {
            setAvailableGoals(res.availableGoals as GoalOption[]);
            setGoalsLoading(false);
          },
          onError: () => {
            setGoalsLoading(false);
          }
        }
      );
    }
  }, [step]);

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(s => s + 1);
    } else {
      submitForm();
    }
  };

  const submitForm = () => {
    completeOnboarding.mutate({ data: {
      heightCm: Number(formData.heightCm),
      weightKg: Number(formData.weightKg),
      targetWeightKg: Number(formData.targetWeightKg),
      age: Number(formData.age),
      gender: formData.gender as "male" | "female" | "prefer_not_to_say",
      goalMode: formData.goalMode as "cut" | "recomposition" | "lean_bulk" | "maintenance",
      activityLevel: formData.activityLevel as "sedentary" | "lightly_active" | "moderately_active" | "very_active",
      trainingDays: 4,
      trainingLocation: "gym",
      dietaryPreferences: [],
      injuryFlags: [],
    } });
  };

  const isStepValid = () => {
    switch (step) {
      case 1: 
        return Number(formData.heightCm) > 0 && 
               Number(formData.weightKg) > 0 && 
               Number(formData.targetWeightKg) > 0 && 
               Number(formData.age) > 0 && 
               formData.gender !== "";
      case 2: 
        return formData.goalMode !== "";
      case 3: 
        return formData.activityLevel !== "";
      default: 
        return false;
    }
  };

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
                    onClick={() => setFormData({ ...formData, goalMode: opt.mode })}
                  />
                ))}
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

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent pt-12">
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
      </div>
    </div>
  );
}
