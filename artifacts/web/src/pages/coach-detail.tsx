import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Star, ChevronLeft, ChevronRight, User, CheckCircle, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getObjectUrl } from "@/hooks/use-photo-upload";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface ServiceDetail {
  id: number;
  title: string;
  description: string | null;
  price: number | null;
  specializations: string[];
  activeOffer: string | null;
  beforeAfterPhotos: string[];
  coachId: number;
  coachName: string;
  coachPhoto: string | null;
  coachBio: string | null;
}

export default function CoachDetail() {
  const { t, isRTL } = useLanguage();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const serviceId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [subscribed, setSubscribed] = useState(false);

  const { data: service, isLoading } = useQuery<ServiceDetail>({
    queryKey: [`/api/public/services/${serviceId}`],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/public/services/${serviceId}`);
      if (!res.ok) throw new Error("Service not found");
      return res.json();
    },
    enabled: !!serviceId,
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!service) throw new Error("No service");
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/public/coaches/${service.coachId}/subscribe`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("services.failedToSubscribe"));
      }
      return res.json();
    },
    onSuccess: async () => {
      setSubscribed(true);
      await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
      toast({ title: t("coaches.subscribeSuccess") });
      setLocation("/coaches");
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  // When user returns to this page after login/signup, auto-trigger subscribe
  useEffect(() => {
    if (!user || !service || subscribeMutation.isPending || subscribed) return;
    const pendingId = localStorage.getItem("pendingSubscriptionServiceId");
    if (pendingId === String(serviceId) && user.role === "member" && user.coachId !== service.coachId) {
      localStorage.removeItem("pendingSubscriptionServiceId");
      subscribeMutation.mutate();
    }
  }, [user, service]);

  function handleSubscribe() {
    if (!user) {
      // Save the service ID so we can auto-subscribe after login/signup
      localStorage.setItem("pendingSubscriptionServiceId", String(serviceId));
      setLocation(`/signup`);
      return;
    }
    subscribeMutation.mutate();
  }

  function handleBack() {
    setLocation("/coaches");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{t("services.noServicesFound")}</p>
        <Button variant="outline" onClick={handleBack}>{t("coaches.backToBrowse")}</Button>
      </div>
    );
  }

  const photos = service.beforeAfterPhotos ?? [];
  const isAlreadySubscribed = user?.coachId === service.coachId;

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <header className="border-b border-border sticky top-0 z-50 bg-background/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              {isRTL ? <ChevronRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold">BodyPro</span>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
          <div className="flex-shrink-0">
            {service.coachPhoto ? (
              <img
                src={getObjectUrl(service.coachPhoto)}
                alt={service.coachName}
                className="w-28 h-28 rounded-full object-cover border-4 border-primary/30"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-primary/20 border-4 border-primary/30 flex items-center justify-center text-3xl font-bold text-primary">
                {service.coachName?.split(" ").filter(Boolean).map(p => p[0]).join("").slice(0, 2).toUpperCase() || <User className="w-10 h-10" />}
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-start">
            <h1 className="text-3xl font-bold mb-1">{service.title}</h1>
            <p className="text-sm text-muted-foreground mb-2">{t("services.by")} {service.coachName}</p>

            {service.specializations.length > 0 && (
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-3">
                {service.specializations.map(s => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </div>
            )}

            {service.activeOffer && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary font-medium mb-3">
                <Star className="w-3.5 h-3.5" />
                {service.activeOffer}
              </div>
            )}

            {service.price !== null && (
              <p className="text-2xl font-bold text-primary">
                {service.price} <span className="text-base font-normal text-muted-foreground">{t("coaches.omrPerMonth")}</span>
              </p>
            )}
          </div>
        </div>

        {service.coachBio && (
          <div className="mb-6 p-5 bg-card border border-border rounded-2xl">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("coaches.aboutCoach")}</h2>
            <p className="text-base leading-relaxed">{service.coachBio}</p>
          </div>
        )}

        {service.description && (
          <div className="mb-8 p-5 bg-card border border-border rounded-2xl">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("services.aboutService")}</h2>
            <p className="text-base leading-relaxed">{service.description}</p>
          </div>
        )}


        {photos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">{t("coaches.beforeAfter")}</h2>
            <div className="relative w-full aspect-square sm:aspect-video rounded-2xl overflow-hidden border border-border">
              <img
                src={getObjectUrl(photos[currentPhoto])}
                alt={`Before & After ${currentPhoto + 1}`}
                className="w-full h-full object-cover"
              />
              {photos.length > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "right-2" : "left-2"} bg-background/80`}
                    onClick={() => setCurrentPhoto(p => (p - 1 + photos.length) % photos.length)}
                  >
                    {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "left-2" : "right-2"} bg-background/80`}
                    onClick={() => setCurrentPhoto(p => (p + 1) % photos.length)}
                  >
                    {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPhoto(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${i === currentPhoto ? "bg-primary" : "bg-white/50"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {photos.map((p, i) => (
                  <img
                    key={i}
                    src={getObjectUrl(p)}
                    alt={`Photo ${i + 1}`}
                    onClick={() => setCurrentPhoto(i)}
                    className={`w-16 h-16 rounded-lg object-cover cursor-pointer flex-shrink-0 border-2 transition-colors ${i === currentPhoto ? "border-primary" : "border-border"}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="sticky bottom-6">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-lg">
            {isAlreadySubscribed || subscribed ? (
              <div className="flex items-center justify-center gap-2 text-primary font-semibold py-2">
                <CheckCircle className="w-5 h-5" />
                {t("coaches.alreadySubscribed")}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {service.price !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("coaches.monthlyPlan")}</span>
                    <span className="text-xl font-bold text-primary">{service.price} {t("coaches.omr")}</span>
                  </div>
                )}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleSubscribe}
                  disabled={subscribeMutation.isPending}
                >
                  {subscribeMutation.isPending
                    ? t("common.loading")
                    : user
                      ? t("coaches.subscribe")
                      : t("coaches.signInToSubscribe")}
                </Button>
                {!user && (
                  <p className="text-xs text-center text-muted-foreground">{t("coaches.signInHint")}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
