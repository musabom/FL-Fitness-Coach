import { useState } from "react";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useCoachClient } from "@/context/coach-client-context";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, User, Dumbbell, Utensils, Target, LayoutDashboard, LogOut, UserCircle2, Star } from "lucide-react";
import { motion } from "framer-motion";

interface CoachClient {
  id: number;
  email: string;
  fullName: string | null;
  goalMode: string | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  mealCompliancePct: number | null;
  workoutCompliancePct: number | null;
}

function ComplianceBadge({ pct, label, icon: Icon }: { pct: number | null; label: string; icon: React.ElementType }) {
  if (pct === null) return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
      <Icon className="w-3.5 h-3.5" />
      <span>{label}: —</span>
    </div>
  );

  const color = pct >= 80 ? "text-primary" : pct >= 50 ? "text-yellow-500" : "text-destructive";
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}: {pct}%</span>
    </div>
  );
}

function goalLabel(mode: string | null): string {
  const labels: Record<string, string> = {
    cut: "Cut",
    lean_bulk: "Lean Bulk",
    recomposition: "Recomp",
    maintenance: "Maintenance",
    custom: "Custom",
  };
  return mode ? (labels[mode] ?? mode) : "—";
}

export default function CoachClients() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { setActiveClient } = useCoachClient();
  const [, setLocation] = useLocation();

  const clientsQuery = useQuery<CoachClient[]>({
    queryKey: ["coach", "clients"],
    queryFn: () => customFetch<CoachClient[]>("/api/coach/clients"),
  });

  const clients = clientsQuery.data ?? [];

  const handleSelectClient = (client: CoachClient) => {
    setActiveClient({
      id: client.id,
      name: client.fullName || client.email,
      email: client.email,
      mode: "coach",
    });
    setLocation("/dashboard");
  };

  const handleMyDashboard = () => {
    setActiveClient(null);
    setLocation("/dashboard");
  };

  return (
    <div className="mobile-container flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="px-6 pt-12 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("coachClients.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.fullName ?? user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/coach/services")}
            className="text-xs gap-1.5 text-muted-foreground"
          >
            <Star className="w-3.5 h-3.5" />
            {t("services.manageServices")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/coach/profile")}
            className="text-xs gap-1.5 text-muted-foreground"
          >
            <UserCircle2 className="w-3.5 h-3.5" />
            {t("coaches.editProfile")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMyDashboard}
            className="text-xs gap-1.5 text-muted-foreground"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            {t("coachClients.viewDashboard")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout.mutate()}
            className="text-xs gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t("common.signOut")}
          </Button>
        </div>
      </header>

      {/* Client list */}
      <main className="flex-1 overflow-y-auto px-6 pb-8 space-y-3">
        {clientsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-20">
            <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No clients assigned yet</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Ask your admin to assign clients to you</p>
          </div>
        ) : (
          clients.map((client, i) => (
            <motion.button
              key={client.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleSelectClient(client)}
              className="w-full text-left bg-card border border-card-border rounded-2xl p-4 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{client.fullName || "—"}</p>
                    <p className="text-xs text-muted-foreground">{client.email}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1.5">
                  <ComplianceBadge pct={client.mealCompliancePct} label="Meals" icon={Utensils} />
                  <ComplianceBadge pct={client.workoutCompliancePct} label="Workout" icon={Dumbbell} />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end mb-0.5">
                    <Target className="w-3 h-3" />
                    <span>{goalLabel(client.goalMode)}</span>
                  </div>
                  {client.weightKg && (
                    <p className="text-xs text-muted-foreground">
                      {client.weightKg}kg → {client.targetWeightKg ?? "?"}kg
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          ))
        )}
      </main>
    </div>
  );
}
