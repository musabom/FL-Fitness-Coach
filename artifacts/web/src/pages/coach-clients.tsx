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
  CalendarClock, UserMinus, Bell, MessageCircle, Info, Copy, Check, Wallet,
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

// ── Inline info tooltip ───────────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-0.5">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        <Info className="w-3 h-3" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 4 }}
              className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 bg-popover border border-border rounded-xl shadow-xl px-3 py-2 w-44 text-xs text-muted-foreground leading-relaxed"
            >
              {text}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  );
}

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

// ── Copy link button with brief "Copied!" feedback ────────────────────────────
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
        copied ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10"
      }`}
      title="Copy invite link"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy link"}
    </button>
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
  const [earningsExpanded, setEarningsExpanded] = useState(false);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  interface ServiceInviteLink {
    serviceId: number;
    serviceTitle: string;
    servicePrice: number | null;
    token: string;
    inviteUrl: string;
  }
  const inviteLinksQuery = useQuery<ServiceInviteLink[]>({
    queryKey: ["coach", "service-invite-links"],
    queryFn: () => customFetch("/api/coach/service-invite-links"),
    staleTime: 5 * 60_000,
  });
  const inviteLinks = inviteLinksQuery.data ?? [];
  const inviteLinkByServiceId = Object.fromEntries(inviteLinks.map(l => [l.serviceId, l.inviteUrl]));

  const unreadQuery = useQuery<Record<string, number>>({
    queryKey: ["coach", "unread"],
    queryFn: () => customFetch("/api/coach/unread-counts"),
    refetchInterval: 30_000,
  });
  const unreadCounts = unreadQuery.data ?? {};

  interface CoachFinancials {
    commissionPct: number;
    coachPct: number;
    totalGross: number;
    platformCut: number;
    coachEarnings: number;
    services: { serviceId: number; serviceTitle: string; price: number; clientCount: number; gross: number; platformCut: number; coachEarnings: number }[];
  }
  const financialsQuery = useQuery<CoachFinancials>({
    queryKey: ["coach", "financials"],
    queryFn: () => customFetch<CoachFinancials>("/api/coach/financials"),
    refetchInterval: 60_000,
    staleTime: 0,
  });
  const fin = financialsQuery.data;

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

  // Build groups from filteredClients
  const allGroups: { key: string; label: string; price: number | null; clients: CoachClient[] }[] = [];
  const groupSeen = new Map<string, number>();
  filteredClients.forEach(client => {
    const key = client.serviceId ? `service-${client.serviceId}` : "unassigned";
    if (!groupSeen.has(key)) {
      groupSeen.set(key, allGroups.length);
      allGroups.push({ key, label: client.serviceTitle ?? "No Service", price: client.servicePrice, clients: [] });
    }
    allGroups[groupSeen.get(key)!].clients.push(client);
  });
  allGroups.sort((a, b) => {
    if (a.key === "unassigned") return 1;
    if (b.key === "unassigned") return -1;
    return a.label.localeCompare(b.label);
  });
  const visibleGroups = serviceFilter === "all" ? allGroups : allGroups.filter(g => g.key === serviceFilter);

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const handleSelectClient = (client: CoachClient) => {
    setLocation(`/coach/clients/${client.id}`);
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
            <p className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
              At Risk
              <InfoTooltip text="Clients completing less than 50% of their meals or workouts today. Follow up to keep them on track." />
            </p>
          </div>
          <div className={`bg-card border rounded-2xl p-3 text-center ${(stats?.expiringSoon ?? 0) > 0 ? "border-yellow-500/40" : "border-card-border"}`}>
            <Clock className={`w-4 h-4 mx-auto mb-1 ${(stats?.expiringSoon ?? 0) > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
            <p className={`text-xl font-bold ${(stats?.expiringSoon ?? 0) > 0 ? "text-yellow-500" : ""}`}>{stats?.expiringSoon ?? 0}</p>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
              Expiring
              <InfoTooltip text="Clients whose subscription ends within 5 days. A good time to check in and discuss renewal." />
            </p>
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
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-0.5">Renewing this week<InfoTooltip text="Subscriptions that expire within the next 7 days." /></p>
                  </div>
                </div>
                <div className={`flex-1 bg-card border rounded-2xl p-3 flex items-center gap-3 ${(stats?.inactiveCount ?? 0) > 0 ? "border-destructive/30" : "border-card-border"}`}>
                  <UserMinus className={`w-5 h-5 flex-shrink-0 ${(stats?.inactiveCount ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm font-semibold ${(stats?.inactiveCount ?? 0) > 0 ? "text-destructive" : ""}`}>{stats?.inactiveCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-0.5">Inactive<InfoTooltip text="Clients whose subscription has lapsed — they no longer have active access." /></p>
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

      {/* ── My Earnings ─────────────────────────────────────────── */}
      {fin && (
        <div className="px-5 pb-3">
          {/* Collapsible header */}
          <button
            onClick={() => setEarningsExpanded(v => !v)}
            className="w-full flex items-center justify-between mb-2"
          >
            <div className="flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Earnings</span>
            </div>
            {earningsExpanded
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {earningsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
                  {/* Gross + "this month" */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Gross revenue</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">this month</span>
                      <span className="text-sm font-bold">{fin.totalGross.toFixed(2)} OMR</span>
                    </div>
                  </div>

                  {/* Stacked bar */}
                  <div className="w-full h-2.5 rounded-full overflow-hidden bg-muted flex">
                    <div className="h-full bg-destructive/50 transition-all" style={{ width: `${fin.commissionPct}%` }} />
                    <div className="h-full bg-primary transition-all" style={{ width: `${fin.coachPct}%` }} />
                  </div>

                  {/* Split rows */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-destructive/50" />
                        <span className="text-xs text-muted-foreground">Platform ({fin.commissionPct}%)</span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">− {fin.platformCut.toFixed(2)} OMR</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/30 pt-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-xs font-semibold">Your earnings ({fin.coachPct}%)</span>
                      </div>
                      <span className="text-sm font-bold text-primary">{fin.coachEarnings.toFixed(2)} OMR</span>
                    </div>
                  </div>

                  {/* Per-service breakdown */}
                  {fin.services.filter(s => s.clientCount > 0).length > 0 && (
                    <div className="border-t border-border/30 pt-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">By Service</p>
                      {fin.services.filter(s => s.clientCount > 0).map(s => (
                        <div key={s.serviceId} className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{s.serviceTitle}</p>
                            <p className="text-xs text-muted-foreground">{s.clientCount} client{s.clientCount !== 1 ? "s" : ""} · {s.price} OMR ea.</p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-xs font-semibold text-primary">{s.coachEarnings.toFixed(2)} OMR</p>
                            <p className="text-xs text-muted-foreground">{s.gross.toFixed(2)} gross</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* My Services Strip */}
      <div className="px-5 pb-2">
        {/* Header row — toggle left, Manage right */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setServicesExpanded(v => !v)}
            className="flex items-center gap-1.5"
          >
            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Services</span>
            {services.length > 0 && (
              <span className="text-xs bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-medium">{services.length}</span>
            )}
            {servicesExpanded
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />}
          </button>
          <button
            onClick={() => setLocation("/coach/services")}
            className="text-xs text-primary font-medium hover:underline"
          >
            Manage →
          </button>
        </div>

        <AnimatePresence>
          {servicesExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
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
                      <div
                        key={s.id}
                        className="flex-shrink-0 bg-card border border-card-border rounded-2xl px-4 py-3 text-left min-w-[180px] max-w-[220px] hover:border-primary/50 transition-all flex flex-col gap-2"
                      >
                        <button onClick={() => setLocation("/coach/services")} className="text-left">
                          <p className="text-sm font-semibold truncate">{s.title}</p>
                          {s.price !== null && (
                            <p className="text-xs text-primary font-medium mt-0.5">{s.price} OMR</p>
                          )}
                          {s.specializations.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{s.specializations.slice(0, 2).join(" · ")}</p>
                          )}
                        </button>
                        {inviteLinkByServiceId[s.id] && (
                          <CopyLinkButton url={inviteLinkByServiceId[s.id]} />
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setLocation("/coach/services")}
                      className="flex-shrink-0 flex items-center justify-center w-12 border border-dashed border-border rounded-2xl hover:border-primary hover:text-primary text-muted-foreground transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
              onClick={() => { setFilterTab(tab); setServiceFilter("all"); }}
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

        {/* Service filter chips — only shown when there are multiple service groups */}
        {allGroups.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pt-0.5">
            <button
              onClick={() => setServiceFilter("all")}
              className={`flex-shrink-0 text-xs font-medium py-1 px-3 rounded-xl transition-colors ${
                serviceFilter === "all"
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-card border border-card-border text-muted-foreground hover:text-foreground"
              }`}
            >
              All services
            </button>
            {allGroups.map(g => (
              <button
                key={g.key}
                onClick={() => setServiceFilter(g.key)}
                className={`flex-shrink-0 text-xs font-medium py-1 px-3 rounded-xl transition-colors whitespace-nowrap ${
                  serviceFilter === g.key
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-card border border-card-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {g.label}
                <span className="ml-1 opacity-60">{g.clients.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Client list */}
      <main className="flex-1 overflow-y-auto px-5 pb-8">
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
        ) : (() => {
          let globalIndex = 0;

          return visibleGroups.map(group => {
            const isCollapsed = collapsedGroups.has(group.key);
            return (
            <div key={group.key} className="mb-4">
              {/* Service group header — clickable to collapse */}
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center gap-2 mb-2 group"
              >
                <Briefcase className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-xs font-semibold text-foreground">{group.label}</span>
                {group.price !== null && group.key !== "unassigned" && (
                  <span className="text-xs text-primary font-medium">{group.price} OMR</span>
                )}
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 ml-auto">
                  {group.clients.length}
                </span>
                {isCollapsed
                  ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                }
              </button>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
              <div className="space-y-2">
                {group.clients.map((client) => {
                  const i = globalIndex++;
                  return (
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
                            className="relative p-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex-shrink-0"
                            title="View client detail"
                          >
                            <ChevronRight className="w-4 h-4" />
                            {(unreadCounts[client.id] ?? 0) > 0 && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                {unreadCounts[client.id]}
                              </span>
                            )}
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
                  );
                })}
              </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
          });
        })()}
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
