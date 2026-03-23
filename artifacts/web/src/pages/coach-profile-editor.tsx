import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, X, Plus, Upload, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { usePhotoUpload, getObjectUrl } from "@/hooks/use-photo-upload";

interface CoachProfileData {
  photoUrl: string | null;
  specializations: string[];
  pricePerMonth: number | null;
  bio: string | null;
  activeOffer: string | null;
  beforeAfterPhotos: string[];
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function fetchCoachProfile(): Promise<CoachProfileData> {
  const res = await fetch(`${BASE}/api/coach/profile`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

export default function CoachProfileEditor() {
  const { t, isRTL } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadPhoto, isUploading } = usePhotoUpload();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [specInput, setSpecInput] = useState("");
  const [pricePerMonth, setPricePerMonth] = useState("");
  const [bio, setBio] = useState("");
  const [activeOffer, setActiveOffer] = useState("");
  const [beforeAfterPhotos, setBeforeAfterPhotos] = useState<string[]>([]);
  const [uploadingBAP, setUploadingBAP] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const bapInputRef = useRef<HTMLInputElement>(null);

  const { isLoading } = useQuery<CoachProfileData>({
    queryKey: ["/api/coach/profile"],
    queryFn: fetchCoachProfile,
    onSuccess: (data) => {
      setPhotoUrl(data.photoUrl);
      setSpecializations(data.specializations ?? []);
      setPricePerMonth(data.pricePerMonth != null ? String(data.pricePerMonth) : "");
      setBio(data.bio ?? "");
      setActiveOffer(data.activeOffer ?? "");
      setBeforeAfterPhotos(data.beforeAfterPhotos ?? []);
    },
  } as any);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/coach/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          photoUrl: photoUrl || null,
          specializations,
          pricePerMonth: pricePerMonth ? Number(pricePerMonth) : null,
          bio: bio || null,
          activeOffer: activeOffer || null,
          beforeAfterPhotos,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("coaches.profileSaved") });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/coaches"] });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  async function handlePhotoUpload(file: File) {
    try {
      const path = await uploadPhoto(file);
      setPhotoUrl(path);
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  }

  async function handleBAPUpload(files: FileList) {
    if (beforeAfterPhotos.length + files.length > 5) {
      toast({ title: t("coaches.maxPhotosError"), variant: "destructive" });
      return;
    }
    setUploadingBAP(true);
    try {
      const paths: string[] = [];
      for (const file of Array.from(files)) {
        const path = await uploadPhoto(file);
        paths.push(path);
      }
      setBeforeAfterPhotos(prev => [...prev, ...paths]);
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setUploadingBAP(false);
    }
  }

  function addSpecialization() {
    const val = specInput.trim();
    if (!val || specializations.length >= 3 || specializations.includes(val)) return;
    setSpecializations(prev => [...prev, val]);
    setSpecInput("");
  }

  function removeSpecialization(s: string) {
    setSpecializations(prev => prev.filter(x => x !== s));
  }

  function removeBAP(idx: number) {
    setBeforeAfterPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/coach/clients")}>
            <ArrowLeft className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />
          </Button>
          <h1 className="text-lg font-semibold">{t("coaches.editProfile")}</h1>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("coaches.saveProfile")}
        </Button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">

        {/* Profile Photo */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {photoUrl ? (
              <img
                src={getObjectUrl(photoUrl)}
                alt="Profile"
                className="w-28 h-28 rounded-full object-cover border-4 border-border"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-muted border-4 border-border flex items-center justify-center">
                <Camera className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
          />
          <p className="text-sm text-muted-foreground">{t("coaches.photoHint")}</p>
        </div>

        {/* Specializations */}
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            {t("coaches.specializations")} <span className="text-muted-foreground text-xs">({t("coaches.max3")})</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {specializations.map(s => (
              <Badge key={s} variant="secondary" className="gap-1.5 pr-1">
                {s}
                <button onClick={() => removeSpecialization(s)} className="hover:text-destructive transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          {specializations.length < 3 && (
            <div className="flex gap-2">
              <Input
                placeholder={t("coaches.addSpecialization")}
                value={specInput}
                onChange={e => setSpecInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSpecialization())}
              />
              <Button variant="outline" size="icon" onClick={addSpecialization} disabled={!specInput.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Price */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">{t("coaches.price")}</label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              step="0.5"
              placeholder="0.000"
              value={pricePerMonth}
              onChange={e => setPricePerMonth(e.target.value)}
              className={isRTL ? "pl-14" : "pr-14"}
            />
            <span className={`absolute top-1/2 -translate-y-1/2 text-sm text-muted-foreground ${isRTL ? "left-3" : "right-3"}`}>
              {t("coaches.omr")}
            </span>
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className="block text-sm font-medium flex justify-between">
            <span>{t("coaches.bio")}</span>
            <span className={`text-xs ${bio.length > 140 ? "text-amber-400" : "text-muted-foreground"}`}>
              {bio.length}/150
            </span>
          </label>
          <Textarea
            placeholder={t("coaches.bioPlaceholder")}
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 150))}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Active Offer */}
        <div className="space-y-2">
          <label className="block text-sm font-medium flex items-center gap-1.5">
            <Star className="w-4 h-4 text-primary" />
            {t("coaches.offer")}
          </label>
          <Input
            placeholder={t("coaches.offerPlaceholder")}
            value={activeOffer}
            onChange={e => setActiveOffer(e.target.value)}
          />
        </div>

        {/* Before & After Photos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">{t("coaches.beforeAfterPhotos")}</label>
            <span className="text-xs text-muted-foreground">{beforeAfterPhotos.length}/5</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("coaches.maxPhotosHint")}</p>

          <div className="grid grid-cols-3 gap-2">
            {beforeAfterPhotos.map((p, i) => (
              <div key={i} className="relative group">
                <img
                  src={getObjectUrl(p)}
                  alt={`Photo ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-xl border border-border"
                />
                <button
                  onClick={() => removeBAP(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {beforeAfterPhotos.length < 5 && (
              <button
                onClick={() => bapInputRef.current?.click()}
                disabled={uploadingBAP}
                className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
              >
                {uploadingBAP
                  ? <Loader2 className="w-6 h-6 animate-spin" />
                  : <>
                    <Upload className="w-6 h-6" />
                    <span className="text-xs">{t("coaches.upload")}</span>
                  </>
                }
              </button>
            )}
          </div>
          <input
            ref={bapInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleBAPUpload(e.target.files)}
          />
        </div>

        {/* Save button (bottom) */}
        <Button
          size="lg"
          className="w-full"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("common.loading")}</>
            : t("coaches.saveProfile")}
        </Button>
      </div>
    </div>
  );
}
