import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useCoachClient } from "@/context/coach-client-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Dumbbell, Utensils, Target, Clock, User,
  Send, MessageCircle, ClipboardList, TrendingUp,
  CheckCircle2, Loader2, Zap, Moon, StickyNote, LayoutDashboard,
  ChevronDown, ChevronUp,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

interface CoachClient {
  id: number;
  email: string;
  fullName: string | null;
  goalMode: string | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  mealCompliancePct: number | null;
  workoutCompliancePct: number | null;
  subscriptionDaysLeft: number | null;
  subscriptionStatus: string;
  serviceId: number | null;
  servicePrice: number | null;
  serviceTitle: string | null;
  isCancelling: boolean;
}

interface WeightPoint { weightKg: number; date: string; }
interface CheckIn {
  id: number;
  week_date: string;
  weight_kg: number | null;
  energy_level: number | null;
  sleep_quality: number | null;
  notes: string | null;
  created_at: string;
}
interface Message {
  id: number;
  content: string;
  from_coach: boolean;
  read_at: string | null;
  created_at: string;
}
interface CoachService { id: number; title: string; price: number | null; }

function energyLabel(n: number) { return ["😫","😔","😐","🙂","💪"][n - 1] ?? "—"; }
function sleepLabel(n: number) { return ["😩","😪","😐","😌","😴"][n - 1] ?? "—"; }
function goalLabel(mode: string | null) {
  const labels: Record<string, string> = { cut: "Cut", lean_bulk: "Lean Bulk", recomposition: "Recomp", maintenance: "Maintenance", custom: "Custom" };
  return mode ? (labels[mode] ?? mode) : "—";
}

type Tab = "progress" | "checkins" | "messages" | "notes";

export default function CoachClientDetail() {
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const { setActiveClient } = useCoachClient();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("progress");
  const [msgText, setMsgText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [showServicePicker, setShowServicePicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch client info from coach clients list
  const clientsQuery = useQuery<CoachClient[]>({
    queryKey: ["coach", "clients"],
    queryFn: () => customFetch<CoachClient[]>("/api/coach/clients"),
  });
  const client = clientsQuery.data?.find(c => c.id === clientId);

  const weightQuery = useQuery<WeightPoint[]>({
    queryKey: ["coach", "weight", clientId],
    queryFn: () => customFetch<WeightPoint[]>(`/api/coach/clients/${clientId}/weight-history`),
    enabled: tab === "progress",
  });

  const checkinsQuery = useQuery<CheckIn[]>({
    queryKey: ["coach", "checkins", clientId],
    queryFn: () => customFetch<CheckIn[]>(`/api/coach/clients/${clientId}/checkins`),
    enabled: tab === "checkins",
  });

  const messagesQuery = useQuery<Message[]>({
    queryKey: ["coach", "messages", clientId],
    queryFn: () => customFetch<Message[]>(`/api/coach/clients/${clientId}/messages`),
    enabled: tab === "messages",
    refetchInterval: tab === "messages" ? 10_000 : false,
  });

  const notesQuery = useQuery<{ id: number; note: string; created_at: string }[]>({
    queryKey: ["coach", "notes", clientId],
    queryFn: () => customFetch(`/api/coach/clients/${clientId}/notes`),
    enabled: tab === "notes",
  });

  const servicesQuery = useQuery<CoachService[]>({
    queryKey: ["coach", "services"],
    queryFn: () => customFetch<CoachService[]>("/api/coach/services"),
  });

  useEffect(() => {
    if (tab === "messages") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data, tab]);

  const sendMessage = useMutation({
    mutationFn: (content: string) => customFetch(`/api/coach/clients/${clientId}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
    }),
    onSuccess: () => { setMsgText(""); qc.invalidateQueries({ queryKey: ["coach", "messages", clientId] }); },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  const addNote = useMutation({
    mutationFn: (note: string) => customFetch(`/api/coach/clients/${clientId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }),
    }),
    onSuccess: () => { setNoteText(""); qc.invalidateQueries({ queryKey: ["coach", "notes", clientId] }); },
    onError: () => toast({ title: "Failed to save note", variant: "destructive" }),
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: number) => customFetch(`/api/coach/clients/${clientId}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach", "notes", clientId] }),
  });

  const assignService = useMutation({
    mutationFn: (serviceId: number | null) => customFetch(`/api/coach/clients/${clientId}/service`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId }),
    }),
    onSuccess: () => {
      setShowServicePicker(false);
      qc.invalidateQueries({ queryKey: ["coach", "clients"] });
      toast({ title: "Service assigned" });
    },
    onError: () => toast({ title: "Failed to assign service", variant: "destructive" }),
  });

  const handleViewDashboard = () => {
    if (!client) return;
    setActiveClient({ id: client.id, name: client.fullName || client.email, email: client.email, mode: "coach" });
    setLocation("/dashboard");
  };

  if (clientsQuery.isLoading) return (
    <div className="mobile-container flex items-center justify-center h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (!client) return (
    <div className="mobile-container flex flex-col items-center justify-center h-screen gap-4">
      <p className="text-muted-foreground">Client not found</p>
      <Button onClick={() => setLocation("/coach/clients")}>Back to clients</Button>
    </div>
  );

  const weightData = weightQuery.data ?? [];
  const activeServices = (servicesQuery.data ?? []).filter(s => (s as any).isActive !== false);

  return (
    <div className="mobile-container flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="px-5 pt-10 pb-3 flex items-center gap-3">
        <button onClick={() => setLocation("/coach/clients")} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg truncate">{client.fullName || client.email}</p>
          <p className="text-xs text-muted-foreground truncate">{client.email}</p>
        </div>
        <button
          onClick={handleViewDashboard}
          className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-xl px-3 py-1.5 transition-colors"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </button>
      </header>

      {/* Client summary strip */}
      <div className="px-5 pb-3">
        <div className="bg-card border border-card-border rounded-2xl p-3 flex items-center gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Target className="w-3 h-3" /><span>{goalLabel(client.goalMode)}</span>
              {client.weightKg && <><span>·</span><span>{client.weightKg}kg → {client.targetWeightKg ?? "?"}kg</span></>}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className={`flex items-center gap-1 ${(client.mealCompliancePct ?? 0) >= 80 ? "text-primary" : (client.mealCompliancePct ?? 0) >= 50 ? "text-yellow-500" : "text-destructive"}`}>
                <Utensils className="w-3 h-3" />{client.mealCompliancePct ?? "—"}%
              </span>
              <span className={`flex items-center gap-1 ${(client.workoutCompliancePct ?? 0) >= 80 ? "text-primary" : (client.workoutCompliancePct ?? 0) >= 50 ? "text-yellow-500" : "text-destructive"}`}>
                <Dumbbell className="w-3 h-3" />{client.workoutCompliancePct ?? "—"}%
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {client.subscriptionDaysLeft !== null && (
              <div className={`flex items-center gap-1 text-xs ${client.subscriptionDaysLeft <= 5 ? "text-destructive" : "text-muted-foreground"}`}>
                <Clock className="w-3 h-3" />{client.subscriptionDaysLeft}d left
              </div>
            )}
            {/* Service assignment */}
            <div className="relative">
              <button
                onClick={() => setShowServicePicker(v => !v)}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
              >
                {client.serviceTitle ? `${client.serviceTitle} (${client.servicePrice} OMR)` : "Assign service"}
                <ChevronDown className="w-3 h-3" />
              </button>
              <AnimatePresence>
                {showServicePicker && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-6 z-20 bg-card border border-border rounded-xl shadow-xl min-w-[180px] py-1"
                  >
                    <button onClick={() => assignService.mutate(null)} className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
                      No service
                    </button>
                    {activeServices.map(s => (
                      <button key={s.id} onClick={() => assignService.mutate(s.id)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted ${client.serviceId === s.id ? "text-primary font-medium" : ""}`}>
                        {s.title} {s.price !== null ? `· ${s.price} OMR` : ""}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-5 pb-2 flex gap-1.5">
        {(["progress", "checkins", "messages", "notes"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-xl transition-colors capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-card border border-card-border text-muted-foreground"}`}>
            {t === "progress" ? "📈 Progress" : t === "checkins" ? "✅ Check-ins" : t === "messages" ? "💬 Messages" : "📝 Notes"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <main className="flex-1 overflow-y-auto px-5 pb-6">

        {/* PROGRESS TAB */}
        {tab === "progress" && (
          <div className="space-y-3 pt-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weight History</p>
            {weightQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : weightData.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No weight entries yet</div>
            ) : (
              <div className="bg-card border border-card-border rounded-2xl p-3">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={weightData.map(p => ({ ...p, date: new Date(p.date).toLocaleDateString("en", { month: "short", day: "numeric" }) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={28} />
                    {client.targetWeightKg && (
                      <ReferenceLine y={client.targetWeightKg} stroke="var(--primary)" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "Target", fill: "var(--primary)", fontSize: 10 }} />
                    )}
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v} kg`, "Weight"]} labelStyle={{ color: "var(--foreground)" }} />
                    <Line type="monotone" dataKey="weightKg" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: "var(--primary)" }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
                  <span>Start: {weightData[0]?.weightKg}kg</span>
                  <span>Latest: {weightData[weightData.length - 1]?.weightKg}kg</span>
                  {client.targetWeightKg && <span>Target: {client.targetWeightKg}kg</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CHECK-INS TAB */}
        {tab === "checkins" && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weekly Check-ins</p>
            {checkinsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : (checkinsQuery.data ?? []).length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No check-ins yet.<br/>Client submits weekly from their dashboard.</div>
            ) : (
              (checkinsQuery.data ?? []).map(ci => (
                <div key={ci.id} className="bg-card border border-card-border rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{new Date(ci.week_date).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</p>
                    {ci.weight_kg && <span className="text-xs text-primary font-medium">{ci.weight_kg} kg</span>}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {ci.energy_level && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />Energy: {energyLabel(ci.energy_level)}</span>}
                    {ci.sleep_quality && <span className="flex items-center gap-1"><Moon className="w-3 h-3" />Sleep: {sleepLabel(ci.sleep_quality)}</span>}
                  </div>
                  {ci.notes && <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-2 py-1.5">{ci.notes}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {/* MESSAGES TAB */}
        {tab === "messages" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-2 pt-1 overflow-y-auto pb-2">
              {messagesQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : (messagesQuery.data ?? []).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No messages yet. Say hi!</div>
              ) : (
                (messagesQuery.data ?? []).map(msg => (
                  <div key={msg.id} className={`flex ${msg.from_coach ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.from_coach ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-card-border rounded-bl-sm"}`}>
                      <p>{msg.content}</p>
                      <p className={`text-[10px] mt-0.5 ${msg.from_coach ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(msg.created_at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            {/* Message input */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Input value={msgText} onChange={e => setMsgText(e.target.value)}
                placeholder="Type a message…" className="flex-1 text-sm"
                onKeyDown={e => { if (e.key === "Enter" && msgText.trim()) sendMessage.mutate(msgText.trim()); }} />
              <Button size="sm" disabled={!msgText.trim() || sendMessage.isPending}
                onClick={() => sendMessage.mutate(msgText.trim())} className="px-3">
                {sendMessage.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        )}

        {/* NOTES TAB */}
        {tab === "notes" && (
          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              <Input value={noteText} onChange={e => setNoteText(e.target.value)}
                placeholder="Add a note…" className="flex-1 text-sm"
                onKeyDown={e => { if (e.key === "Enter" && noteText.trim()) addNote.mutate(noteText.trim()); }} />
              <Button size="sm" disabled={!noteText.trim() || addNote.isPending}
                onClick={() => addNote.mutate(noteText.trim())} className="px-3">
                {addNote.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StickyNote className="w-3.5 h-3.5" />}
              </Button>
            </div>
            {notesQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : (notesQuery.data ?? []).length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No notes yet</div>
            ) : (
              (notesQuery.data ?? []).map(n => (
                <div key={n.id} className="bg-card border border-card-border rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <p className="text-sm flex-1">{n.note}</p>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
                    <button onClick={() => deleteNote.mutate(n.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive/50 hover:text-destructive">
                      <span className="text-xs">✕</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
