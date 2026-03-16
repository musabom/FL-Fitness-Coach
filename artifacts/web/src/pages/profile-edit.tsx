import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Check, Loader2 } from "lucide-react";

interface ProfileFormData {
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  age: number;
  activityLevel: string;
  trainingDays: number;
}

export default function ProfileEdit() {
  const [, setLocation] = useLocation();
  const { profile, isLoading, updateProfile } = useProfile();
  const [formData, setFormData] = useState<ProfileFormData | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        targetWeightKg: profile.targetWeightKg,
        age: profile.age,
        activityLevel: profile.activityLevel,
        trainingDays: profile.trainingDays,
      });
    }
  }, [profile]);

  if (isLoading || !formData) {
    return (
      <div className="mobile-container flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const handleSave = () => {
    updateProfile.mutate(
      { 
        data: {
          heightCm: Number(formData.heightCm),
          weightKg: Number(formData.weightKg),
          targetWeightKg: Number(formData.targetWeightKg),
          age: Number(formData.age),
          trainingDays: formData.trainingDays as 3 | 4 | 5 | 6,
          activityLevel: formData.activityLevel as "sedentary" | "lightly_active" | "moderately_active" | "very_active",
        } 
      },
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

      <main className="flex-1 overflow-y-auto px-6 py-6 pb-32 space-y-8 scrollbar-none">
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

      </main>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent pt-12">
        <Button 
          className="w-full shadow-2xl" 
          size="lg" 
          onClick={handleSave}
          disabled={updateProfile.isPending || saved}
        >
          {updateProfile.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
