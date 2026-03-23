import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Star, Tag, DollarSign, ChevronRight, User, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getObjectUrl } from "@/hooks/use-photo-upload";
import { useAuth } from "@/hooks/use-auth";

interface CoachCard {
  id: number;
  fullName: string;
  photoUrl: string | null;
  specializations: string[];
  pricePerMonth: number | null;
  bio: string | null;
  activeOffer: string | null;
  beforeAfterPhotos: string[];
}

function CoachAvatar({ photoUrl, name, size = "lg" }: { photoUrl: string | null; name: string; size?: "lg" | "xl" }) {
  const sz = size === "xl" ? "w-24 h-24 text-3xl" : "w-16 h-16 text-xl";
  if (photoUrl) {
    return (
      <img
        src={getObjectUrl(photoUrl)}
        alt={name}
        className={`${sz} rounded-full object-cover border-2 border-border`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  const initials = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`${sz} rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center font-semibold text-primary`}>
      {initials || <User className="w-6 h-6" />}
    </div>
  );
}

export default function CoachesBrowse() {
  const { t, isRTL } = useLanguage();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { user } = useAuth();

  const { data: coaches = [], isLoading } = useQuery<CoachCard[]>({
    queryKey: ["/api/public/coaches", debouncedSearch],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const params = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : "";
      const res = await fetch(`${base}/api/public/coaches${params}`);
      if (!res.ok) throw new Error("Failed to load coaches");
      return res.json();
    },
  });

  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout((window as any).__coachSearchTimeout);
    (window as any).__coachSearchTimeout = setTimeout(() => setDebouncedSearch(val), 300);
  }

  function handleSignIn() {
    setLocation("/login");
  }

  function handleDashboard() {
    if (user?.role === "admin") setLocation("/admin");
    else if (user?.role === "coach") setLocation("/coach/clients");
    else setLocation("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">BodyPro</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {user ? (
              <Button size="sm" onClick={handleDashboard}>
                {t("coaches.myDashboard")}
              </Button>
            ) : (
              <Button size="sm" onClick={handleSignIn}>
                {t("login.signIn")}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 py-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-3">{t("coaches.browseTitle")}</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">{t("coaches.browseSubtitle")}</p>

        {/* Search */}
        <div className="relative max-w-lg mx-auto">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
          <Input
            className={`${isRTL ? "pr-9" : "pl-9"} h-11 bg-card border-border`}
            placeholder={t("coaches.searchPlaceholder")}
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Coach Grid */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
                <div className="h-12 bg-muted rounded" />
                <div className="h-9 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : coaches.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">{t("coaches.noCoachesFound")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {coaches.map(coach => (
              <div
                key={coach.id}
                className="bg-card border border-border rounded-2xl p-5 flex flex-col hover:border-primary/40 transition-colors group cursor-pointer"
                onClick={() => setLocation(`/coaches/${coach.id}`)}
              >
                {/* Coach header */}
                <div className="flex items-start gap-3 mb-3">
                  <CoachAvatar photoUrl={coach.photoUrl} name={coach.fullName || "?"} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base leading-tight truncate">{coach.fullName}</h3>
                    {coach.pricePerMonth !== null && (
                      <p className="text-primary font-bold text-sm mt-0.5">
                        {coach.pricePerMonth} {t("coaches.omrPerMonth")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Active offer */}
                {coach.activeOffer && (
                  <div className="mb-2 px-2.5 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-xs text-primary font-medium flex items-center gap-1.5">
                    <Star className="w-3 h-3 flex-shrink-0" />
                    {coach.activeOffer}
                  </div>
                )}

                {/* Specializations */}
                {coach.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {coach.specializations.map(s => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Bio */}
                {coach.bio && (
                  <p className="text-sm text-muted-foreground mb-3 flex-1 line-clamp-2">{coach.bio}</p>
                )}

                {/* CTA */}
                <Button
                  className="w-full mt-auto"
                  size="sm"
                  onClick={e => { e.stopPropagation(); setLocation(`/coaches/${coach.id}`); }}
                >
                  {t("coaches.viewProfile")}
                  <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
