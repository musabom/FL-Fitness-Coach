import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, X, Star, Upload, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { usePhotoUpload, getObjectUrl } from "@/hooks/use-photo-upload";

interface CoachServiceData {
  id: number;
  coachId: number;
  title: string;
  description: string | null;
  price: number | null;
  specializations: string[];
  activeOffer: string | null;
  beforeAfterPhotos: string[];
  isActive: boolean;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function CoachServices() {
  const { t, isRTL } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadPhoto, isUploading } = usePhotoUpload();

  const [editingService, setEditingService] = useState<CoachServiceData | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [specInput, setSpecInput] = useState("");
  const [activeOffer, setActiveOffer] = useState("");
  const [beforeAfterPhotos, setBeforeAfterPhotos] = useState<string[]>([]);
  const [uploadingBAP, setUploadingBAP] = useState(false);

  const bapInputRef = useRef<HTMLInputElement>(null);

  const servicesQuery = useQuery<CoachServiceData[]>({
    queryKey: ["/api/coach/services"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/coach/services`, { credentials: "include" });
      if (!res.ok) throw new Error(t("services.failedToLoad"));
      return res.json();
    },
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setPrice("");
    setSpecializations([]);
    setSpecInput("");
    setActiveOffer("");
    setBeforeAfterPhotos([]);
    setEditingService(null);
    setShowForm(false);
  }

  function openEditForm(service: CoachServiceData) {
    setTitle(service.title);
    setDescription(service.description ?? "");
    setPrice(service.price != null ? String(service.price) : "");
    setSpecializations(service.specializations ?? []);
    setActiveOffer(service.activeOffer ?? "");
    setBeforeAfterPhotos(service.beforeAfterPhotos ?? []);
    setEditingService(service);
    setShowForm(true);
  }

  function openNewForm() {
    resetForm();
    setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        price: price ? Number(price) : null,
        specializations,
        activeOffer: activeOffer.trim() || null,
        beforeAfterPhotos,
      };

      const url = editingService
        ? `${BASE}/api/coach/services/${editingService.id}`
        : `${BASE}/api/coach/services`;
      const method = editingService ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("services.failedToSave"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("services.saved") });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/services"] });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      const res = await fetch(`${BASE}/api/coach/services/${serviceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(t("services.failedToDelete"));
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("services.deleted") });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/services"] });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  function addSpecialization() {
    const val = specInput.trim();
    if (!val || specializations.length >= 5 || specializations.includes(val)) return;
    setSpecializations(prev => [...prev, val]);
    setSpecInput("");
  }

  function removeSpecialization(s: string) {
    setSpecializations(prev => prev.filter(x => x !== s));
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
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : t("services.uploadFailed"), variant: "destructive" });
    } finally {
      setUploadingBAP(false);
    }
  }

  function removeBAP(idx: number) {
    setBeforeAfterPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  const services = servicesQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/coach/clients")}>
            <ArrowLeft className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />
          </Button>
          <h1 className="text-lg font-semibold">{t("services.title")}</h1>
        </div>
        {!showForm && (
          <Button size="sm" onClick={openNewForm} className="gap-1.5">
            <Plus className="w-4 h-4" />
            {t("services.addService")}
          </Button>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {showForm && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">
                {editingService ? t("services.editService") : t("services.newService")}
              </h2>
              <button onClick={resetForm}>
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">{t("services.serviceTitle")}</label>
              <Input
                placeholder={t("services.titlePlaceholder")}
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">{t("services.description")}</label>
              <Textarea
                placeholder={t("services.descriptionPlaceholder")}
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 300))}
                rows={3}
                className="resize-none"
              />
              <span className="text-xs text-muted-foreground">{description.length}/300</span>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">{t("coaches.price")}</label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0.000"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className={isRTL ? "pl-14" : "pr-14"}
                />
                <span className={`absolute top-1/2 -translate-y-1/2 text-sm text-muted-foreground ${isRTL ? "left-3" : "right-3"}`}>
                  {t("coaches.omr")}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium">
                {t("coaches.specializations")} <span className="text-muted-foreground text-xs">({t("services.max5")})</span>
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
              {specializations.length < 5 && (
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">{t("coaches.beforeAfterPhotos")}</label>
                <span className="text-xs text-muted-foreground">{beforeAfterPhotos.length}/5</span>
              </div>
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

            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !title.trim()}
            >
              {saveMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("common.loading")}</>
                : editingService ? t("services.updateService") : t("services.createService")}
            </Button>
          </div>
        )}

        {servicesQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : services.length === 0 && !showForm ? (
          <div className="text-center py-20">
            <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t("services.noServices")}</p>
            <p className="text-muted-foreground/60 text-xs mt-1">{t("services.noServicesHint")}</p>
            <Button className="mt-4" size="sm" onClick={openNewForm}>
              <Plus className="w-4 h-4 mr-1" />
              {t("services.addService")}
            </Button>
          </div>
        ) : (
          services.map(service => (
            <div key={service.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-sm">{service.title}</h3>
                  {service.price !== null && (
                    <p className="text-primary font-bold text-xs mt-0.5">
                      {service.price} {t("coaches.omrPerMonth")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(service)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(service.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {service.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{service.description}</p>
              )}
              {service.activeOffer && (
                <div className="mb-2 px-2 py-1 bg-primary/10 border border-primary/20 rounded text-xs text-primary font-medium flex items-center gap-1">
                  <Star className="w-3 h-3 flex-shrink-0" />
                  {service.activeOffer}
                </div>
              )}
              {service.specializations.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {service.specializations.map(s => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
