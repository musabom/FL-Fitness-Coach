import { useState, useEffect } from "react";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { OptionCard } from "@/components/OptionCard";
import { ChevronLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Onboarding() {
  const { completeOnboarding, useGetAvailableGoals } = useProfile();
  const getGoalsMutation = useGetAvailableGoals();
  
  const [step, setStep] = useState(1);
  const totalSteps = 11;

  const [formData, setFormData] = useState<any>({
    heightCm: "",
    weightKg: "",
    targetWeightKg: "",
    age: "",
    gender: "",
    goalMode: "",
    activityLevel: "",
    trainingDays: 3,
    trainingLocation: "",
    dietaryPreferences: [],
    injuryFlags: [],
  });

  const [availableGoals, setAvailableGoals] = useState<any[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);

  useEffect(() => {
    if (step === 6) {
      setGoalsLoading(true);
      getGoalsMutation.mutate(
        { data: { currentWeightKg: Number(formData.weightKg), targetWeightKg: Number(formData.targetWeightKg) } },
        {
          onSuccess: (res) => {
            setAvailableGoals(res.availableGoals);
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
    const payload = {
      ...formData,
      heightCm: Number(formData.heightCm),
      weightKg: Number(formData.weightKg),
      targetWeightKg: Number(formData.targetWeightKg),
      age: Number(formData.age),
      dietaryPreferences: formData.dietaryPreferences.length === 0 ? ["none"] : formData.dietaryPreferences,
      injuryFlags: formData.injuryFlags.length === 0 ? ["none"] : formData.injuryFlags,
    };
    
    completeOnboarding.mutate({ data: payload });
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return formData.heightCm > 0;
      case 2: return formData.weightKg > 0;
      case 3: return formData.targetWeightKg > 0;
      case 4: return formData.age > 0;
      case 5: return formData.gender !== "";
      case 6: return formData.goalMode !== "";
      case 7: return formData.activityLevel !== "";
      case 8: return formData.trainingDays > 0;
      case 9: return formData.trainingLocation !== "";
      case 10: return true; // checkboxes optional
      case 11: return true; // checkboxes optional
      default: return false;
    }
  };

  const toggleArrayItem = (field: string, value: string) => {
    setFormData((prev: any) => {
      const array = prev[field] as string[];
      if (value === "none") {
        return { ...prev, [field]: ["none"] };
      }
      const newArray = array.includes(value) 
        ? array.filter(i => i !== value) 
        : [...array.filter(i => i !== "none"), value];
      return { ...prev, [field]: newArray };
    });
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">How tall are you?</h2>
            <div className="relative">
              <Input 
                type="number" 
                className="text-4xl h-24 pl-6 pr-20 font-light"
                value={formData.heightCm}
                onChange={e => setFormData({ ...formData, heightCm: e.target.value })}
                autoFocus
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground font-light">cm</span>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">What is your current weight?</h2>
            <div className="relative">
              <Input 
                type="number" 
                className="text-4xl h-24 pl-6 pr-20 font-light"
                value={formData.weightKg}
                onChange={e => setFormData({ ...formData, weightKg: e.target.value })}
                autoFocus
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground font-light">kg</span>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">What is your target weight?</h2>
            <div className="relative">
              <Input 
                type="number" 
                className="text-4xl h-24 pl-6 pr-20 font-light"
                value={formData.targetWeightKg}
                onChange={e => setFormData({ ...formData, targetWeightKg: e.target.value })}
                autoFocus
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground font-light">kg</span>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">How old are you?</h2>
            <div className="relative">
              <Input 
                type="number" 
                className="text-4xl h-24 pl-6 pr-24 font-light"
                value={formData.age}
                onChange={e => setFormData({ ...formData, age: e.target.value })}
                autoFocus
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xl text-muted-foreground font-light">years</span>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">What is your biological sex?</h2>
            <p className="text-muted-foreground">Required for accurate basal metabolic rate calculations.</p>
            <div className="space-y-3">
              {[
                { id: "male", label: "Male" },
                { id: "female", label: "Female" },
                { id: "prefer_not_to_say", label: "Prefer not to say" }
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
        );
      case 6:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">What is your primary goal?</h2>
            <p className="text-muted-foreground">Based on your target weight gap of {Math.abs(Number(formData.weightKg) - Number(formData.targetWeightKg)).toFixed(1)}kg</p>
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
      case 7:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">Activity Level</h2>
            <p className="text-muted-foreground">Not including your workouts.</p>
            <div className="space-y-3">
              {[
                { id: "sedentary", label: "Sedentary", desc: "Desk job, mostly sitting" },
                { id: "lightly_active", label: "Lightly Active", desc: "On feet occasionally" },
                { id: "moderately_active", label: "Moderately Active", desc: "On feet much of the day" },
                { id: "very_active", label: "Very Active", desc: "Physical job, construction, etc." }
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
      case 8:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">How many days per week will you train?</h2>
            <div className="space-y-3">
              {[3, 4, 5, 6].map(days => (
                <OptionCard 
                  key={days}
                  title={`${days} days`}
                  selected={formData.trainingDays === days}
                  onClick={() => setFormData({ ...formData, trainingDays: days })}
                />
              ))}
            </div>
          </div>
        );
      case 9:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">Where will you train?</h2>
            <div className="space-y-3">
              {[
                { id: "gym", label: "Gym" },
                { id: "home", label: "Home" },
                { id: "both", label: "Both" }
              ].map(opt => (
                <OptionCard 
                  key={opt.id}
                  title={opt.label}
                  selected={formData.trainingLocation === opt.id}
                  onClick={() => setFormData({ ...formData, trainingLocation: opt.id })}
                />
              ))}
            </div>
          </div>
        );
      case 10:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">Dietary Preferences</h2>
            <p className="text-muted-foreground">Select all that apply.</p>
            <div className="space-y-3">
              {[
                { id: "none", label: "None / No restrictions" },
                { id: "vegetarian", label: "Vegetarian" },
                { id: "vegan", label: "Vegan" },
                { id: "halal", label: "Halal" },
                { id: "gluten_free", label: "Gluten Free" },
                { id: "dairy_free", label: "Dairy Free" }
              ].map(opt => (
                <OptionCard 
                  key={opt.id}
                  title={opt.label}
                  type="checkbox"
                  selected={formData.dietaryPreferences.includes(opt.id)}
                  onClick={() => toggleArrayItem('dietaryPreferences', opt.id)}
                />
              ))}
            </div>
          </div>
        );
      case 11:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight">Current Injuries</h2>
            <p className="text-muted-foreground">Select all that apply.</p>
            <div className="space-y-3">
              {[
                { id: "none", label: "No injuries" },
                { id: "knee", label: "Knee" },
                { id: "shoulder", label: "Shoulder" },
                { id: "lower_back", label: "Lower Back" }
              ].map(opt => (
                <OptionCard 
                  key={opt.id}
                  title={opt.label}
                  type="checkbox"
                  selected={formData.injuryFlags.includes(opt.id)}
                  onClick={() => toggleArrayItem('injuryFlags', opt.id)}
                />
              ))}
            </div>
          </div>
        );
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
          <div className="w-10 h-10" /> // Spacer
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
              <Loader2 className="w-5 h-5 animate-spin" /> Finalizing...
            </span>
          ) : step === totalSteps ? "Generate Plan" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
