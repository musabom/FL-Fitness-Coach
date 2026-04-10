import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ChevronLeft, Plus, Trash2, Pencil, Check, X, RotateCcw,
  Dumbbell, Loader2, BedDouble, Zap, ChevronDown, ChevronUp,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/bottom-nav";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

// ── Types ─────────────────────────────────────────────────────────────────────

interface CycleSlot {
  id: number;
  program_id: number;
  position: number;
  workout_id: number | null;
  workout_name: string | null;
  label: string | null;
}

interface CycleProgram {
  id: number;
  name: string;
  start_date: string;
  cycle_length: number;
  is_active: boolean;
  created_at: string;
  slots: CycleSlot[];
}

interface LibraryWorkout {
  id: number;
  workout_name: string;
  total_calories: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTodayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function computeTodayPosition(prog: CycleProgram): { position: number; daysSince: number } | null {
  const today = getTodayLocal();
  const startMs = new Date(prog.start_date + "T00:00:00").getTime();
  const todayMs = new Date(today + "T00:00:00").getTime();
  const daysSince = Math.floor((todayMs - startMs) / 86400000);
  if (daysSince < 0) return null;
  const position = ((daysSince % prog.cycle_length) + prog.cycle_length) % prog.cycle_length;
  return { position, daysSince };
}

// ── Workout Picker Sheet ──────────────────────────────────────────────────────

function WorkoutPickerSheet({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (workoutId: number | null) => void;
}) {
  const { data: workouts = [], isLoading } = useQuery<LibraryWorkout[]>({
    queryKey: ["workouts"],
    queryFn: () => customFetch<LibraryWorkout[]>(`${BASE}/workouts`),
    staleTime: 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ maxWidth: 672, margin: "0 auto" }}>
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="bg-[#111111] border-t border-border/40 rounded-t-2xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/30">
          <h3 className="font-semibold text-sm">Pick a Workout</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2 pb-6">
          {/* Rest day option */}
          <button
            onClick={() => onPick(null)}
            className="w-full text-left rounded-xl px-4 py-3 border border-border/40 bg-[#1A1A1A] hover:border-primary/40 transition-all"
          >
            <div className="flex items-center gap-3">
              <BedDouble className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm text-muted-foreground">Rest Day (no workout)</span>
            </div>
          </button>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && workouts.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <Dumbbell className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No workouts yet</p>
              <Link href="/training/builder">
                <span className="text-xs text-primary underline underline-offset-2">Create workouts first</span>
              </Link>
            </div>
          )}

          {workouts.map(w => (
            <button
              key={w.id}
              onClick={() => onPick(w.id)}
              className="w-full text-left rounded-xl px-4 py-3 border border-border/40 bg-[#1A1A1A] hover:border-primary/40 transition-all"
            >
              <p className="font-semibold text-sm text-foreground">{w.workout_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{Math.round(w.total_calories)} kcal</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Create Program Sheet ──────────────────────────────────────────────────────

function CreateProgramSheet({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(getTodayLocal());
  const [cycleLength, setCycleLength] = useState(5);

  const createMutation = useMutation({
    mutationFn: (body: any) =>
      customFetch(`${BASE}/cycle-programs`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cycle-programs"] });
      toast({ title: "Cycle program created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to create program", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ maxWidth: 672, margin: "0 auto" }}>
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="bg-[#111111] border-t border-border/40 rounded-t-2xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/30">
          <h3 className="font-semibold text-sm">New Cycle Program</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase">Program Name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Push Pull Legs + Rest"
              className="bg-[#1A1A1A] border-border/40"
            />
          </div>

          {/* Start date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-[#1A1A1A] border-border/40"
            />
            <p className="text-[11px] text-muted-foreground">Day 1 of your cycle falls on this date</p>
          </div>

          {/* Cycle length */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase">Cycle Length (days)</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCycleLength(v => Math.max(1, v - 1))}
                className="w-10 h-10 rounded-xl bg-[#1A1A1A] border border-border/40 flex items-center justify-center text-foreground hover:border-primary/40 transition-colors"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <span className="text-2xl font-bold text-primary">{cycleLength}</span>
                <span className="text-xs text-muted-foreground ml-1">days</span>
              </div>
              <button
                onClick={() => setCycleLength(v => Math.min(14, v + 1))}
                className="w-10 h-10 rounded-xl bg-[#1A1A1A] border border-border/40 flex items-center justify-center text-foreground hover:border-primary/40 transition-colors"
              >
                +
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              e.g. 5 days = 4 training + 1 rest, repeating continuously
            </p>
          </div>

          <Button
            onClick={() => {
              if (!name.trim()) return toast({ title: "Program name is required", variant: "destructive" });
              createMutation.mutate({ name: name.trim(), start_date: startDate, cycle_length: cycleLength });
            }}
            disabled={createMutation.isPending}
            className="w-full h-12 rounded-xl bg-primary text-black font-semibold"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Program"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Program Card ──────────────────────────────────────────────────────────────

function ProgramCard({ prog }: { prog: CycleProgram }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(prog.name);

  const todayPos = computeTodayPosition(prog);

  const deleteMutation = useMutation({
    mutationFn: () => customFetch(`${BASE}/cycle-programs/${prog.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cycle-programs"] });
      toast({ title: "Program deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      customFetch(`${BASE}/cycle-programs/${prog.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cycle-programs"] }),
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      customFetch(`${BASE}/cycle-programs/${prog.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cycle-programs"] });
      setEditingName(false);
    },
    onError: () => toast({ title: "Failed to rename", variant: "destructive" }),
  });

  const assignSlotMutation = useMutation({
    mutationFn: ({ position, workout_id }: { position: number; workout_id: number | null }) =>
      customFetch(`${BASE}/cycle-programs/${prog.id}/slots`, {
        method: "PUT",
        body: JSON.stringify({ slots: [{ position, workout_id }] }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cycle-programs"] });
      setPickerSlot(null);
      toast({ title: "Slot updated" });
    },
    onError: () => toast({ title: "Failed to update slot", variant: "destructive" }),
  });

  return (
    <>
      <Card className={`bg-[#1A1A1A] border-border/40 overflow-hidden ${!prog.is_active ? "opacity-60" : ""}`}>
        {/* Header */}
        <div className="flex items-start gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") renameMutation.mutate(nameVal);
                    if (e.key === "Escape") { setEditingName(false); setNameVal(prog.name); }
                  }}
                  autoFocus
                  className="h-7 text-sm bg-transparent border-primary/40 px-2"
                />
                <button onClick={() => renameMutation.mutate(nameVal)} className="text-primary"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setEditingName(false); setNameVal(prog.name); }} className="text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-foreground">{prog.name}</p>
                <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><RotateCcw className="w-3 h-3" />{prog.cycle_length}-day cycle</span>
              <span>·</span>
              <span>From {formatDate(prog.start_date)}</span>
              {todayPos !== null && (
                <>
                  <span>·</span>
                  <span className="text-primary font-medium">Today: Day {todayPos.position + 1}</span>
                </>
              )}
            </div>
          </div>

          {/* Active toggle */}
          <button
            onClick={() => toggleActiveMutation.mutate(!prog.is_active)}
            className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all ${
              prog.is_active
                ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                : "bg-muted/40 text-muted-foreground border-border/30 hover:border-primary/30"
            }`}
          >
            {prog.is_active ? "Active" : "Paused"}
          </button>

          {/* Delete */}
          <button
            onClick={() => deleteMutation.mutate()}
            className="shrink-0 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Slot quick preview (collapsed) */}
        {!expanded && (
          <div className="px-4 pb-3">
            <div className="flex gap-1.5 flex-wrap">
              {prog.slots.map((slot, i) => {
                const isToday = todayPos?.position === slot.position;
                return (
                  <div
                    key={slot.position}
                    className={`rounded-lg px-2 py-1 text-[10px] font-medium border transition-all ${
                      isToday
                        ? "bg-primary text-black border-primary"
                        : slot.workout_id
                        ? "bg-[#252525] text-foreground border-border/30"
                        : "bg-[#1E1E1E] text-muted-foreground border-border/20"
                    }`}
                  >
                    D{i + 1}{slot.workout_id ? "" : " · Rest"}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expanded slot details */}
        {expanded && (
          <div className="border-t border-border/30 px-4 py-3 space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase mb-2">Cycle Days</p>
            {prog.slots.map(slot => {
              const isToday = todayPos?.position === slot.position;
              return (
                <button
                  key={slot.position}
                  onClick={() => setPickerSlot(slot.position)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all text-left ${
                    isToday
                      ? "bg-primary/10 border-primary/40 hover:bg-primary/15"
                      : "bg-[#222222] border-border/20 hover:border-primary/30"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    isToday ? "bg-primary text-black" : "bg-[#2A2A2A] text-muted-foreground"
                  }`}>
                    {slot.position + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    {slot.workout_id ? (
                      <>
                        <p className={`text-sm font-medium ${isToday ? "text-foreground" : "text-foreground"}`}>
                          {slot.workout_name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Day {slot.position + 1}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <BedDouble className="w-3.5 h-3.5" /> Rest Day
                        </p>
                        <p className="text-[10px] text-muted-foreground">Day {slot.position + 1} · Tap to assign workout</p>
                      </>
                    )}
                  </div>
                  {isToday && (
                    <span className="shrink-0 text-[10px] font-semibold text-primary bg-primary/15 rounded-full px-2 py-0.5">Today</span>
                  )}
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* Expand/collapse toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground/50 pb-2.5 hover:text-muted-foreground transition-colors pt-1"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Collapse</> : <><ChevronDown className="w-3.5 h-3.5" /> Edit slots</>}
        </button>
      </Card>

      {/* Workout picker */}
      {pickerSlot !== null && (
        <WorkoutPickerSheet
          onClose={() => setPickerSlot(null)}
          onPick={(workoutId) => assignSlotMutation.mutate({ position: pickerSlot, workout_id: workoutId })}
        />
      )}
    </>
  );
}

// ── Shared content component (used both as tab and as standalone page) ─────────

export function CycleProgramContent() {
  const [showCreate, setShowCreate] = useState(false);

  const { data: programs = [], isLoading } = useQuery<CycleProgram[]>({
    queryKey: ["cycle-programs"],
    queryFn: () => customFetch<CycleProgram[]>(`${BASE}/cycle-programs`),
    staleTime: 0,
  });

  return (
    <div className="space-y-3">
      {/* Info banner */}
      <div className="px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
        <div className="flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-primary">How it works</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Assign your existing workouts to each day of the cycle. The schedule repeats
              every N days regardless of day of week — no need to create new workouts.
            </p>
          </div>
        </div>
      </div>

      {/* Program list */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && programs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[#1A1A1A] flex items-center justify-center">
            <RotateCcw className="w-6 h-6 text-muted-foreground/40" />
          </div>
          <div>
            <p className="font-medium text-sm text-foreground">No cycle programs yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a rotating schedule and assign your workouts to each day
            </p>
          </div>
        </div>
      )}

      {programs.map(prog => (
        <ProgramCard key={prog.id} prog={prog} />
      ))}

      {/* Create button (inline) */}
      <Button
        onClick={() => setShowCreate(true)}
        className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-sm gap-2"
      >
        <Plus className="w-4 h-4" />
        New Cycle Program
      </Button>

      {showCreate && <CreateProgramSheet onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ── Standalone page (accessible via /training/cycle direct URL) ───────────────

export default function CycleProgramBuilder() {
  return (
    <div className="mobile-container flex flex-col bg-background min-h-screen pb-24">
      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-xl z-20 border-b border-border/40">
        <Link href="/training/builder">
          <button className="w-9 h-9 flex items-center justify-center rounded-full border border-border/40 hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-primary" />
          <h1 className="text-base font-semibold">Cycle Programs</h1>
        </div>
        <div className="w-9" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-28">
        <CycleProgramContent />
      </div>

      <BottomNav />
    </div>
  );
}
