import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { usePhotoUpload, getObjectUrl } from "@/hooks/use-photo-upload";

interface CoachProfileData {
  fullName: string | null;
  photoUrl: string | null;
  bio: string | null;
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

  const [fullName, setFullName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [bio, setBio] = useState("");

  const photoInputRef = useRef<HTMLInputElement>(null);

  const { isLoading, data: profileData } = useQuery<CoachProfileData>({
    queryKey: ["/api/coach/profile"],
    queryFn: fetchCoachProfile,
  });

  useEffect(() => {
    if (profileData) {
      setFullName(profileData.fullName ?? "");
      setPhotoUrl(profileData.photoUrl ?? null);
      setBio(profileData.bio ?? "");
    }
  }, [profileData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/coach/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: fullName || null,
          photoUrl: photoUrl || null,
          bio: bio || null,
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
      setLocation("/coach/clients");
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

        {/* Full Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">{t("coaches.fullName")}</label>
          <Input
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">{t("coaches.bio")}</label>
            <span className={`text-xs ${bio.length > 140 ? "text-amber-400" : "text-muted-foreground"}`}>
              {bio.length}/150
            </span>
          </div>
          <Textarea
            placeholder={t("coaches.bioPlaceholder")}
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 150))}
            rows={5}
            className="resize-none"
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
