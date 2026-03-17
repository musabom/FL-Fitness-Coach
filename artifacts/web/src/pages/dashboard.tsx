import { usePlan } from "@/hooks/use-plan";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Settings, LogOut, Loader2, ChevronRight, UtensilsCrossed } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { plan, isLoading } = usePlan();
  const { logout } = useAuth();

  if (isLoading) {
    return (
      <div className="mobile-container flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mobile-container flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-bold mb-2">No active plan</h2>
        <p className="text-muted-foreground mb-6">You need to complete onboarding to get your plan.</p>
        <Link href="/onboarding" className="w-full">
          <Button className="w-full">Start Onboarding</Button>
        </Link>
      </div>
    );
  }

  const weightGapStr = plan.weightKg > plan.targetWeightKg 
    ? `You want to lose ${(plan.weightKg - plan.targetWeightKg).toFixed(1)} kg`
    : plan.weightKg < plan.targetWeightKg 
      ? `You want to gain ${(plan.targetWeightKg - plan.weightKg).toFixed(1)} kg`
      : "You are at your target weight";

  const goalLabels: Record<string, string> = {
    recomposition: "Lose fat & preserve muscle",
    cut: "Lose body fat",
    lean_bulk: "Build lean muscle",
    maintenance: "Maintain weight",
  };

  return (
    <div className="mobile-container overflow-y-auto scrollbar-none pb-12">
      <header className="px-6 py-6 flex justify-between items-center sticky top-0 bg-background/80 backdrop-blur-xl z-10 border-b border-border/50">
        <h1 className="text-xl font-semibold tracking-tight">Your Plan</h1>
        <div className="flex items-center gap-3">
          <Link href="/profile/edit" className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
            <Settings className="w-5 h-5 text-foreground" />
          </Link>
          <button 
            onClick={() => logout.mutate()} 
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-6 pt-8 space-y-10">
        
        {/* Calorie Target */}
        <section className="flex flex-col items-center">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3">Daily Target</div>
          <div className="text-7xl font-light tracking-tighter text-primary">{plan.calorieTarget}</div>
          <div className="text-sm text-muted-foreground mt-1">kcal</div>
          
          <div className="mt-6 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            {goalLabels[plan.goalMode] || plan.goalMode}
          </div>
        </section>

        {/* Macros Grid */}
        <section className="grid grid-cols-3 gap-3">
          <Card className="p-4 flex flex-col items-center justify-center border-none bg-[#1A1A1A]">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Protein</div>
            <div className="text-2xl font-semibold">{plan.proteinG}<span className="text-sm font-normal text-muted-foreground ml-0.5">g</span></div>
            <div className="w-full h-1 bg-[#3B82F6]/20 mt-3 rounded-full overflow-hidden">
              <div className="h-full bg-[#3B82F6] w-[100%]" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center leading-tight">Builds & repairs muscle tissue</p>
          </Card>
          <Card className="p-4 flex flex-col items-center justify-center border-none bg-[#1A1A1A]">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Carbs</div>
            <div className="text-2xl font-semibold">{plan.carbsG}<span className="text-sm font-normal text-muted-foreground ml-0.5">g</span></div>
            <div className="w-full h-1 bg-[#F59E0B]/20 mt-3 rounded-full overflow-hidden">
              <div className="h-full bg-[#F59E0B] w-[100%]" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center leading-tight">Fuels training & recovery</p>
          </Card>
          <Card className="p-4 flex flex-col items-center justify-center border-none bg-[#1A1A1A]">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Fat</div>
            <div className="text-2xl font-semibold">{plan.fatG}<span className="text-sm font-normal text-muted-foreground ml-0.5">g</span></div>
            <div className="w-full h-1 bg-[#EAB308]/20 mt-3 rounded-full overflow-hidden">
              <div className="h-full bg-[#EAB308] w-[100%]" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center leading-tight">Supports hormones & health</p>
          </Card>
        </section>

        {/* Weight & Timeline */}
        <section className="space-y-3">
          <div className="flex gap-3">
            <Card className="flex-1 p-5 border-border">
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Current</div>
              <div className="text-2xl font-semibold">{plan.weightKg} <span className="text-sm font-normal text-muted-foreground">kg</span></div>
            </Card>
            <Card className="flex-1 p-5 border-border">
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Target</div>
              <div className="text-2xl font-semibold">{plan.targetWeightKg} <span className="text-sm font-normal text-muted-foreground">kg</span></div>
            </Card>
          </div>
          
          <Card className="p-6 border-border">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-base mb-1">Projected Timeline</h3>
                <p className="text-sm text-muted-foreground">{weightGapStr}</p>
              </div>
            </div>
            
            {plan.weeksEstimateLow !== null && plan.weeksEstimateHigh !== null ? (
              <div className="text-3xl font-light">
                {plan.weeksEstimateLow} - {plan.weeksEstimateHigh} <span className="text-lg text-muted-foreground">weeks</span>
              </div>
            ) : (
              <div className="text-xl font-light text-muted-foreground">
                Timeline N/A
              </div>
            )}
            
            {plan.goalMode === "recomposition" && (
              <p className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-lg border border-border/50">
                Your weight may not change much — recomposition replaces fat with muscle. Track how your clothes fit and waist measurements, not just the scale.
              </p>
            )}
          </Card>
        </section>

        {/* Meal Builder link */}
        <section>
          <Link href="/nutrition/meals">
            <Card className="p-4 border-border/50 bg-[#1A1A1A] flex items-center gap-4 hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">Meal Builder</div>
                <div className="text-xs text-muted-foreground mt-0.5">Plan your daily nutrition</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          </Link>
        </section>

        {/* Summary */}
        <section>
          <h3 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-3">Plan Summary</h3>
          <p className="text-foreground/90 leading-relaxed text-[15px]">
            {plan.summaryText}
          </p>
        </section>

      </main>
    </div>
  );
}
