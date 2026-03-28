import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useCoachClient } from "@/context/coach-client-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, ChevronRight, User, Dumbbell, Utensils, Target,
  LayoutDashboard, LogOut, UserCircle2, RefreshCw, Clock,
  Users, AlertTriangle, TrendingUp, Search, X,
  StickyNote, Plus, Trash2, ChevronDown, ChevronUp, Briefcase,
  CalendarClock, UserMinus, Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface CoachClient {
  id: number;
  email: string;
  fullName: string | null;
  goalMode: string | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  mealCompliancePct: number | null;
  workoutCompliancePct: number | null;
  subscriptionStartedAt: string | null;
  subscriptionDaysLeft: number | null;
  subscriptionStatus: string;
  serviceId: number | null;
  servicePrice: number | null;
  serviceTitle: string | null;
  isInactive: boolean;
  isCancelling: boolean;
}

interface CoachService {
  id: number;
  title: string;
  price: number | null;
  specializations: string[];
  isActive: boolean;
}

interface CoachStats {
  totalClients: number;
  monthlyRevenue: number;
  expiringSoon: number;
  renewingThisWeek: number;
  inactiveCount: number;
  goalCounts: Record<string, number>;
}

interface RevenueMonth {
  month: string;
  label: string;
  revenue: number;
  newClients: number;
}

interface ClientNote {
  id: number;
  note: string;
  created_at: string;
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
    cut: "Cut", lean_bulk: "Lean Bulk", recomposition: "Recomp",
    maintenance: "Maintenance", custom: "Custom",
  };
  return mode ? (labels[mode] ?? mode) : "—";
}

function isAtRisk(client: CoachClient) {
  const meal = client.mealCompliancePct;
  const workout = client.workoutCompliancePct;
  if (meal !== null && meal < 50) return true;
  if (workout !== null && workout < 50) return true;
  return false;
}

type FilterTab = "all" | "at-risk" | "expiring" | "inactive";

// ── Notes drawer ──────────────────────────────────────────────────────────────
function NotesDrawer({ client, onClose }: { client: CoachClient; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const notesQuery = useQuery<ClientNote[]>({
    queryKey: ["coach", "notes", client.id],
    queryFn: () => customFetch<ClientNote[]>(`/api/coach/clients/${client.id}/notes`),
  });

  const addNote = useMutation({
    mutationFn: (note: string) =>
      customFetch<ClientNote>(`/api/coach/clients/${client.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["coach", "notes", client.id] });
    },
    onError: () => toast({ title: "Failed to save note", variant: "destructive" }),
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: number) =>
      customFetch(`/api/coach/clients/${client.id}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach", "notes", client.id] }),
  });

  const notes = notesQuery.data ?? [];

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-border rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col"
    >
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 bg-border rounded-full" />
      </div>

      <div className="px-5 pb-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">{client.fullName || client.email}</p>
          <p className="text-xs text-muted-foreground">Coach Notes</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-2 pb-2">
        {notesQuery.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No notes yet</div>
        ) : notes.map(n => (
          <div key={n.id} className="bg-card border border-card-border rounded-xl px-3 py-2.5 flex items-start gap-2">
            <p className="text-sm flex-1">{n.note}</p>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
              <button
                onClick={() => deleteNote.mutate(n.id)}
                className="p-1 rounded hover:bg-destructive/10 text-destructive/50 hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-6 pt-3 border-t border-border flex gap-2">
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 text-sm"
          onKeyDown={e => { if (e.key === "Enter" && text.trim()) addNote.mutate(text.trim()); }}
        />
        <Button
          size="sm"
          disabled={!text.trim() || addNote.isPending}
          onClick={() => addNote.mutate(text.trim())}
          className="gap-1.5"
        >
          {addNote.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add
        </Button>
      </div>
    </motion.div>
  );
}

// ── Revenue History Chart ─────────────────────────────────────────────────────
function RevenueChart() {
  const { data, isLoading } = useQuery<RevenueMonth[]>({
    queryKey: ["coach", "revenue-history"],
    queryFn: () => customFetch<RevenueMonth[]>("/api/coach/revenue-history"),
  });

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>;
  if (!data || data.every(m => m.revenue === 0)) return (
    <div className="text-center py-4 text-xs text-muted-foreground">No subscription history yet</div>
  );

  return (
    <div className="mt-2 bg-card border border-card-border rounded-2xl p-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">New Revenue by Month (OMR)</p>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [`${v} OMR`, "Revenue"]}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CoachClients() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { setActiveClient } = useCoachClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [notesClient, setNotesClient] = useState<CoachClient | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(false);

  const clientsQuery = useQuery<CoachClient[]>({
    queryKey: ["coach", "clients"],
    queryFn: () => customFetch<CoachClient[]>("/api/coach/clients"),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const statsQuery = useQuery<CoachStats>({
    queryKey: ["coach", "stats"],
    queryFn: () => customFetch<CoachStats>("/api/coach/stats"),
    refetchInterval: 60_000,
  });

  const servicesQuery = useQuery<CoachService[]>({
    queryKey: ["coach", "services"],
    queryFn: () => customFetch<CoachService[]>("/api/coach/services"),
  });
  const services = (servicesQuery.data ?? []).filter(s => s.isActive);

  const allClients = clientsQuery.data ?? [];
  const stats = statsQuery.data;

  // Renewal alert: clients expiring in ≤3 days
  const urgentRenewals = allClients.filter(c =>
    !c.isInactive && c.subscriptionDaysLeft !== null && c.subscriptionDaysLeft <= 3
  );

  const filteredClients = allClients
    .filter(c => {
      if (search) {
        const q = search.toLowerCase();
        return (c.fullName ?? "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
      }
      return true;
    })
    .filter(c => {
      if (filterTab === "at-risk") return !c.isInactive && isAtRisk(c);
      if (filterTab === "expiring") return !c.isInactive && c.subscriptionDaysLeft !== null && c.subscriptionDaysLeft <= 5;
      if (filterTab === "inactive") return c.isInactive;
      return !c.isInactive; // "all" hides inactive — they're in their own tab
    });

  const activeClients = allClients.filter(c => !c.isInactive);
  const atRiskCount = activeClients.filter(isAtRisk).length;
  const inactiveCount = allClients.filter(c => c.isInactive).length;

  const handleSelectClient = (client: CoachClient) => {
    setActiveClient({ id: client.id, name: client.fullName || client.email, email: client.email, mode: "coach" });
    setLocation("/dashboard");
  };

  const handleMyDashboard = () => {
    setActiveClient(null);
    setLocation("/dashboard");
  };

  return (
    <div className="mobile-container flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="px-5 pt-10 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user?.fullName ?? user?.email}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <button
            onClick={() => setLocation("/coach/profile")}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground"
            title="My Profile"
          >
            <UserCircle2 className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={() => logout.mutate()}
            className="p-2 rounded-xl hover:bg-red-500/10 text-red-400"
            title="Sign Out"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Renewal Alert Banner */}
      <AnimatePresence>
        {urgentRenewals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-5 mb-2"
          >
            <div className="bg-destructive/10 border border-destructive/30 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <Bell className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-xs text-destructive font-medium flex-1">
                {urgentRenewals.length === 1
                  ? `${urgentRenewals[0].fullName || urgentRenewals[0].email} renews in ${urgentRenewals[0].subscriptionDaysLeft}d — follow up!`
                  : `${urgentRenewals.length} clients renewing within 3 days — follow up!`
                }
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <div className="px-5 pb-3">
        <button
          onClick={() => setStatsExpanded(v => !v)}
          className="w-full flex items-center justify-between mb-2"
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overview</span>
          {statsExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card border border-card-border rounded-2xl p-3 text-center">
            <Users className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold">{stats?.totalClients ?? activeClients.length}</p>
            <p className="text-xs text-muted-foreground">Clients</p>
          </div>
          <div className={`bg-card border rounded-2xl p-3 text-center ${atRiskCount > 0 ? "border-destructive/40" : "border-card-border"}`}>
            <AlertTriangle className={`w-4 h-4 mx-auto mb-1 ${atRiskCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <p className={`text-xl font-bold ${atRiskCount > 0 ? "text-destructive" : ""}`}>{atRiskCount}</p>
            <p className="text-xs text-muted-foreground">At Risk</p>
          </div>
          <div className={`bg-card border rounded-2xl p-3 text-center ${(stats?.expiringSoon ?? 0) > 0 ? "border-yellow-500/40" : "border-card-border"}`}>
            <Clock className={`w-4 h-4 mx-auto mb-1 ${(stats?.expiringSoon ?? 0) > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
            <p className={`text-xl font-bold ${(stats?.expiringSoon ?? 0) > 0 ? "text-yellow-500" : ""}`}>{stats?.expiringSoon ?? 0}</p>
            <p className="text-xs text-muted-foreground">Expiring</p>
          </div>
        </div>

        <AnimatePresence>
          {statsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-2"
            >
              {/* Financial row */}
              <div className="flex gap-2">
                <div className="flex-1 bg-card border border-card-border rounded-2xl p-3 flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{stats?.monthlyRevenue ?? 0} OMR</p>
                    <p className="text-xs text-muted-foreground">Monthly revenue</p>
                  </div>
                </div>
                <div className={`flex-1 bg-card border rounded-2xl p-3 flex items-center gap-3 ${(stats?.renewingThisWeek ?? 0) > 0 ? "border-yellow-500/40" : "border-card-border"}`}>
                  <CalendarClock className={`w-5 h-5 flex-shrink-0 ${(stats?.renewingThisWeek ?? 0) > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm font-semibold ${(stats?.renewingThisWeek ?? 0) > 0 ? "text-yellow-500" : ""}`}>{stats?.renewingThisWeek ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Renewing this week</p>
                  </div>
                </div>
                <div className={`flex-1 bg-card border rounded-2xl p-3 flex items-center gap-3 ${(stats?.inactiveCount ?? 0) > 0 ? "border-destructive/30" : "border-card-border"}`}>
                  <UserMinus className={`w-5 h-5 flex-shrink-0 ${(stats?.inactiveCount ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm font-semibold ${(stats?.inactiveCount ?? 0) > 0 ? "text-destructive" : ""}`}>{stats?.inactiveCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Inactive</p>
                  </div>
                </div>
              </div>

              {/* Goal distribution pills */}
              {stats?.goalCounts && Object.keys(stats.goalCounts).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(stats.goalCounts).map(([g, n]) => (
                    <span key={g} className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                      {goalLabel(g)}: {n}
                    </span>
                  ))}
                </div>
              )}

              {/* Revenue history chart */}
              <RevenueChart />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* My Services Strip */}
      <div className="pb-2">
        <div className="px-5 flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Services</span>
            {services.length > 0 && (
              <span className="text-xs bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-medium">{services.length}</span>
            )}
          </div>
          <button
            onClick={() => setLocation("/coach/services")}
            className="text-xs text-primary font-medium hover:underline"
          >
            Manage →
          </button>
        </div>
        <div className="flex gap-2.5 overflow-x-auto px-5 pb-1 scrollbar-hide">
          {services.length === 0 ? (
            <button
              onClick={() => setLocation("/coach/services")}
              className="flex-shrink-0 flex items-center gap-2 border border-dashed border-border rounded-2xl px-4 py-3 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add your first service</span>
            </button>
          ) : (
            <>
              {services.map(s => (
                <button
                  key={s.id}
                  onClick={() => setLocation("/coach/services")}
                  className="flex-shrink-0 bg-card border border-card-border rounded-2xl px-4 py-3 text-left min-w-[160px] max-w-[200px] hover:border-primary/50 active:scale-[0.97] transition-all"
                >
                  <p className="text-sm font-semibold truncate">{s.title}</p>
                  {s.price !== null && (
                    <p className="text-xs text-primary font-medium mt-0.5">{s.price} OMR</p>
                  )}
                  {s.specializations.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{s.specializations.slice(0, 2).join(" · ")}</p>
                  )}
                </button>
              ))}
              <button
                onClick={() => setLocation("/coach/services")}
                className="flex-shrink-0 flex items-center justify-center w-12 h-full border border-dashed border-border rounded-2xl hover:border-primary hover:text-primary text-muted-foreground transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* My Progress Banner */}
      <div className="px-5 pb-2">
        <button
          onClick={handleMyDashboard}
          className="w-full flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-2xl px-4 py-2.5 hover:bg-primary/20 active:scale-[0.98] transition-all text-left"
        >
          <LayoutDashboard className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-sm font-semibold text-primary flex-1">My Dashboard</p>
          <ChevronRight className="w-4 h-4 text-primary" />
        </button>
      </div>

      {/* Search + Filter tabs */}
      <div className="px-5 pb-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="pl-9 pr-8 h-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {(["all", "at-risk", "expiring", "inactive"] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`flex-shrink-0 flex-1 text-xs font-medium py-1.5 rounded-xl transition-colors min-w-[60px] ${
                filterTab === tab
                  ? tab === "inactive"
                    ? "bg-destructive text-white"
                    : "bg-primary text-primary-foreground"
                  : "bg-card border border-card-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "all"
                ? `All (${activeClients.length})`
                : tab === "at-risk"
                ? `At Risk (${atRiskCount})`
                : tab === "expiring"
                ? `Expiring (${stats?.expiringSoon ?? 0})`
                : `Inactive (${inactiveCount})`
              }
            </button>
          ))}
        </div>
      </div>

      {/* Client list */}
      <main className="flex-1 overflow-y-auto px-5 pb-8 space-y-2">
        {clientsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-16">
            {filterTab === "inactive" ? (
              <>
                <UserMinus className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No inactive clients</p>
              </>
            ) : (
              <>
                <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  {search || filterTab !== "all" ? "No clients match this filter" : "No clients assigned yet"}
                </p>
                {!search && filterTab === "all" && (
                  <Button variant="ghost" size="sm" className="mt-4 gap-2 text-muted-foreground"
                    onClick={() => clientsQuery.refetch()} disabled={clientsQuery.isFetching}>
                    <RefreshCw className={`w-3.5 h-3.5 ${clientsQuery.isFetching ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          filteredClients.map((client, i) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`bg-card border rounded-2xl p-4 ${
                client.isInactive
                  ? "border-destructive/20 opacity-70"
                  : isAtRisk(client)
                  ? "border-destructive/30"
                  : "border-card-border"
              }`}
            >
              {/* Top row */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${client.isInactive ? "bg-muted" : "bg-primary/10"}`}>
                  <User className={`w-5 h-5 ${client.isInactive ? "text-muted-foreground" : "text-primary"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{client.fullName || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                  {client.serviceTitle && (
                    <p className="text-xs text-primary/70 truncate">{client.serviceTitle} · {client.servicePrice ?? "—"} OMR</p>
                  )}
                </div>
                {client.isInactive && (
                  <span className="text-xs text-destructive font-medium bg-destructive/10 px-2 py-0.5 rounded-full">Inactive</span>
                )}
                {!client.isInactive && client.isCancelling && (
                  <span className="text-xs text-yellow-600 font-medium bg-yellow-500/10 px-2 py-0.5 rounded-full">Leaving</span>
                )}
                {!client.isInactive && !client.isCancelling && isAtRisk(client) && (
                  <span className="text-xs text-destructive font-medium bg-destructive/10 px-2 py-0.5 rounded-full">At risk</span>
                )}
                {!client.isInactive && (
                  <button
                    onClick={() => handleSelectClient(client)}
                    className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex-shrink-0"
                    title="View client dashboard"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Compliance + goal */}
              {!client.isInactive && (
                <div className="flex items-center justify-between mb-2.5">
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
                      <p className="text-xs text-muted-foreground">{client.weightKg}kg → {client.targetWeightKg ?? "?"}kg</p>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom row: subscription + notes button */}
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                {client.isInactive ? (
                  <p className="text-xs text-muted-foreground">Subscription lapsed</p>
                ) : client.subscriptionDaysLeft !== null ? (
                  <div className={`flex items-center gap-1.5 text-xs ${client.subscriptionDaysLeft <= 3 ? "text-destructive font-semibold" : client.subscriptionDaysLeft <= 5 ? "text-yellow-500" : "text-muted-foreground"}`}>
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span>{client.subscriptionDaysLeft}d left</span>
                    {client.subscriptionDaysLeft <= 3 && <Bell className="w-3 h-3" />}
                  </div>
                ) : <div />}

                <button
                  onClick={() => setNotesClient(client)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <StickyNote className="w-3.5 h-3.5" />
                  Notes
                </button>
              </div>
            </motion.div>
          ))
        )}
      </main>

      {/* Notes drawer overlay */}
      <AnimatePresence>
        {notesClient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setNotesClient(null)}
            />
            <NotesDrawer client={notesClient} onClose={() => setNotesClient(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
