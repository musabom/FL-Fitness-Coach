import { useState } from "react";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Users, Dumbbell, Utensils, ChevronDown, ChevronUp,
  Shield, UserCheck, User, X, Plus, Search, LogOut, Pencil, Trash2,
  Eye, Activity, Clock, MousePointerClick, ChevronLeft, ChevronRight,
  Check, TrendingUp, DollarSign, UserX, BarChart2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCoachClient } from "@/context/coach-client-context";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AdminUser {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  is_active: boolean;
  goal_mode: string | null;
  coach_name: string | null;
  coach_id: number | null;
}

interface AdminCoach {
  id: number;
  email: string;
  full_name: string | null;
  client_count: number;
  service_price: number;
  estimated_revenue: number;
  clients: Array<{ id: number; email: string; full_name: string | null }>;
}

interface AdminMember {
  id: number;
  email: string;
  full_name: string | null;
  coach_id: number | null;
  coach_name: string | null;
}

interface AdminFood {
  id: number;
  food_name: string;
  food_group: string | null;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number | null;
  dietary_tags: string[] | null;
}

interface AdminExercise {
  id: number;
  name: string;
  exercise_type: string;
  muscle_group: string | null;
  equipment: string | null;
  description: string | null;
}

interface OverviewStats {
  totalMembers: number;
  totalCoaches: number;
  newMembersThisMonth: number;
  unassignedMembers: number;
  estimatedMonthlyRevenue: number;
}

interface GrowthData {
  month: string;
  new_members: number;
}

interface CoachRevenueData {
  id: number;
  name: string;
  client_count: number;
  service_price: number;
  estimated_revenue: number;
}

interface GoalData {
  goal_mode: string;
  count: number;
}

type Tab = "overview" | "members" | "coaches" | "reports" | "content" | "logs";

// ── Helpers ───────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const cfg: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    admin: { label: "Admin", cls: "bg-primary/10 text-primary", icon: Shield },
    coach: { label: "Coach", cls: "bg-blue-500/10 text-blue-400", icon: UserCheck },
    member: { label: "Member", cls: "bg-muted text-muted-foreground", icon: User },
  };
  const { label, cls, icon: Icon } = cfg[role] ?? cfg.member;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

function StatCard({
  icon: Icon, label, value, sub, color = "text-primary",
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data, isLoading } = useQuery<OverviewStats>({
    queryKey: ["admin", "overview"],
    queryFn: () => customFetch<OverviewStats>("/api/admin/overview"),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const stats = data!;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="Total Members" value={stats.totalMembers} sub="active accounts" />
        <StatCard icon={UserCheck} label="Active Coaches" value={stats.totalCoaches} sub="on platform" color="text-blue-400" />
        <StatCard icon={TrendingUp} label="New This Month" value={stats.newMembersThisMonth} sub="new signups" color="text-green-400" />
        <StatCard icon={UserX} label="Unassigned" value={stats.unassignedMembers} sub="no coach yet" color="text-amber-400" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Est. Monthly Revenue</span>
          <DollarSign className="w-4 h-4 text-primary" />
        </div>
        <p className="text-3xl font-bold text-primary">
          {stats.estimatedMonthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} OMR
        </p>
        <p className="text-xs text-muted-foreground mt-1">Based on active subscriptions × coach service prices</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold">Quick Stats</p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Assigned members</span>
            <span className="font-medium">{stats.totalMembers - stats.unassignedMembers}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: stats.totalMembers ? `${((stats.totalMembers - stats.unassignedMembers) / stats.totalMembers) * 100}%` : "0%" }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stats.totalMembers ? Math.round(((stats.totalMembers - stats.unassignedMembers) / stats.totalMembers) * 100) : 0}% assigned</span>
            <span>{stats.unassignedMembers} need a coach</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Members Tab ───────────────────────────────────────────────────────────────
function MembersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "member" | "coach" | "admin">("all");
  const [coachFilter, setCoachFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const { setActiveClient } = useCoachClient();
  const [, setLocation] = useLocation();

  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: () => customFetch<AdminUser[]>("/api/admin/users"),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      customFetch(`/api/admin/users/${id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast({ title: "Role updated" }); },
    onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/admin/users/${id}/deactivate`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast({ title: "User deactivated" }); },
    onError: () => toast({ title: "Failed to deactivate", variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/admin/users/${id}/activate`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast({ title: "User activated" }); },
    onError: () => toast({ title: "Failed to activate", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast({ title: "User deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const users = (usersQuery.data ?? []).filter(u => {
    const matchesSearch = `${u.email} ${u.full_name ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesCoach =
      coachFilter === "all" ||
      (coachFilter === "assigned" && u.coach_id !== null) ||
      (coachFilter === "unassigned" && u.coach_id === null && u.role === "member");
    return matchesSearch && matchesRole && matchesCoach;
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 flex-1">
          {(["all", "member", "coach", "admin"] as const).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`flex-1 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${roleFilter === r ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
        {(["all", "assigned", "unassigned"] as const).map(f => (
          <button
            key={f}
            onClick={() => setCoachFilter(f)}
            className={`flex-1 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${coachFilter === f ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"}`}
          >
            {f === "all" ? "All" : f === "assigned" ? "Has Coach" : "No Coach"}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{users.length} user{users.length !== 1 ? "s" : ""}</p>

      {usersQuery.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">No users match the current filters</div>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className={`bg-card border border-border rounded-xl p-4 ${!user.is_active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{user.full_name || "—"}</p>
                    {!user.is_active && (
                      <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  {user.coach_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">Coach: {user.coach_name}</p>
                  )}
                  {user.role === "member" && !user.coach_id && (
                    <p className="text-xs text-amber-400 mt-0.5">No coach assigned</p>
                  )}
                </div>
                <RoleBadge role={user.role} />
              </div>
              <div className="flex gap-2 flex-wrap">
                {user.role !== "member" && (
                  <Button size="sm" variant="outline" className="text-xs h-7 px-2"
                    onClick={() => changeRoleMutation.mutate({ id: user.id, role: "member" })}
                    disabled={changeRoleMutation.isPending || !user.is_active}>
                    <User className="w-3 h-3 mr-1" /> Set Member
                  </Button>
                )}
                {user.role !== "coach" && (
                  <Button size="sm" variant="outline" className="text-xs h-7 px-2"
                    onClick={() => changeRoleMutation.mutate({ id: user.id, role: "coach" })}
                    disabled={changeRoleMutation.isPending || !user.is_active}>
                    <UserCheck className="w-3 h-3 mr-1" /> Set Coach
                  </Button>
                )}
                {user.role !== "admin" && (
                  <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-primary border-primary/30 hover:bg-primary/10"
                    onClick={() => changeRoleMutation.mutate({ id: user.id, role: "admin" })}
                    disabled={changeRoleMutation.isPending || !user.is_active}>
                    <Shield className="w-3 h-3 mr-1" /> Set Admin
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
                  onClick={() => {
                    setActiveClient({ id: user.id, name: user.full_name || user.email, email: user.email, mode: "admin" });
                    setLocation("/dashboard");
                  }}
                  disabled={!user.is_active}>
                  <Eye className="w-3 h-3 mr-1" /> View
                </Button>
                {user.is_active ? (
                  <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => deactivateMutation.mutate(user.id)}
                    disabled={deactivateMutation.isPending || activateMutation.isPending}>
                    {deactivateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <X className="w-3 h-3 mr-1" />} Deactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-green-400 border-green-400/30 hover:bg-green-400/10"
                    onClick={() => activateMutation.mutate(user.id)}
                    disabled={activateMutation.isPending || deactivateMutation.isPending}>
                    {activateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />} Activate
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-red-500 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => deleteMutation.mutate(user.id)}
                  disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />} Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Coaches Tab ───────────────────────────────────────────────────────────────
function CoachesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedCoach, setExpandedCoach] = useState<number | null>(null);
  const [assigningTo, setAssigningTo] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const coachesQuery = useQuery<AdminCoach[]>({
    queryKey: ["admin", "coaches"],
    queryFn: () => customFetch<AdminCoach[]>("/api/admin/coaches"),
  });

  const membersQuery = useQuery<AdminMember[]>({
    queryKey: ["admin", "members"],
    queryFn: () => customFetch<AdminMember[]>("/api/admin/members"),
    enabled: assigningTo !== null,
  });

  const assignMutation = useMutation({
    mutationFn: ({ coachId, clientId }: { coachId: number; clientId: number }) =>
      customFetch(`/api/admin/coaches/${coachId}/clients/${clientId}`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); setAssigningTo(null); toast({ title: "Client assigned" }); },
  });

  const removeMutation = useMutation({
    mutationFn: ({ coachId, clientId }: { coachId: number; clientId: number }) =>
      customFetch(`/api/admin/coaches/${coachId}/clients/${clientId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast({ title: "Client removed" }); },
  });

  const coaches = coachesQuery.data ?? [];
  const members = (membersQuery.data ?? []).filter(m =>
    !m.coach_id &&
    `${m.email} ${m.full_name ?? ""}`.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const totalRevenue = coaches.reduce((sum, c) => sum + (c.estimated_revenue ?? 0), 0);

  return (
    <div className="space-y-3">
      {coaches.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Est. Revenue</p>
            <p className="text-2xl font-bold text-primary">{totalRevenue.toLocaleString()} OMR</p>
          </div>
          <DollarSign className="w-8 h-8 text-primary/20" />
        </div>
      )}

      {coachesQuery.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : coaches.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">No coaches yet. Promote a member to Coach from the Members tab.</div>
      ) : (
        coaches.map(coach => (
          <div key={coach.id} className="bg-card border border-border rounded-xl">
            <button
              className="w-full flex items-center justify-between p-4"
              onClick={() => setExpandedCoach(expandedCoach === coach.id ? null : coach.id)}
            >
              <div className="text-left flex-1">
                <p className="font-medium text-sm">{coach.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground">{coach.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{coach.client_count} clients</span>
                {coach.service_price > 0 && (
                  <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                    {coach.estimated_revenue} OMR
                  </span>
                )}
                {expandedCoach === coach.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {expandedCoach === coach.id && (
              <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                {coach.service_price > 0 && (
                  <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 mb-3">
                    <span className="text-xs text-muted-foreground">Service price</span>
                    <span className="text-xs font-semibold text-primary">{coach.service_price} OMR/mo</span>
                  </div>
                )}
                {coach.clients.length === 0 && (
                  <p className="text-xs text-muted-foreground">No clients assigned yet.</p>
                )}
                {coach.clients.map((client: any) => (
                  <div key={client.id} className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm">{client.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{client.email}</p>
                    </div>
                    <button
                      onClick={() => removeMutation.mutate({ coachId: coach.id, clientId: client.id })}
                      className="p-1 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {assigningTo === coach.id ? (
                  <div className="mt-3 space-y-2">
                    <Input
                      placeholder="Search unassigned members..."
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {members.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No unassigned members</p>}
                      {members.map(m => (
                        <button
                          key={m.id}
                          onClick={() => assignMutation.mutate({ coachId: coach.id, clientId: m.id })}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                        >
                          <p className="text-xs font-medium">{m.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </button>
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" className="w-full text-xs h-7" onClick={() => setAssigningTo(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="w-full text-xs h-8 mt-2 gap-1"
                    onClick={() => { setAssigningTo(coach.id); setMemberSearch(""); }}>
                    <Plus className="w-3 h-3" /> Assign Client
                  </Button>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────
const GOAL_COLORS: Record<string, string> = {
  cut: "#EF4444",
  bulk: "#3B82F6",
  maintain: "#0D9E75",
  not_set: "#6B7280",
};

function ReportsTab() {
  const growthQuery = useQuery<GrowthData[]>({
    queryKey: ["admin", "reports", "growth"],
    queryFn: () => customFetch<GrowthData[]>("/api/admin/reports/growth"),
  });

  const coachRevenueQuery = useQuery<CoachRevenueData[]>({
    queryKey: ["admin", "reports", "coaches"],
    queryFn: () => customFetch<CoachRevenueData[]>("/api/admin/reports/coaches"),
  });

  const goalsQuery = useQuery<GoalData[]>({
    queryKey: ["admin", "reports", "goals"],
    queryFn: () => customFetch<GoalData[]>("/api/admin/reports/goals"),
  });

  const isLoading = growthQuery.isLoading || coachRevenueQuery.isLoading || goalsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse h-48" />
        ))}
      </div>
    );
  }

  const growth = growthQuery.data ?? [];
  const coachRevenue = (coachRevenueQuery.data ?? []).filter(c => c.client_count > 0 || c.service_price > 0);
  const goals = (goalsQuery.data ?? []).map(g => ({
    ...g,
    name: g.goal_mode === "cut" ? "Cut" : g.goal_mode === "bulk" ? "Bulk" : g.goal_mode === "maintain" ? "Maintain" : "Not Set",
    fill: GOAL_COLORS[g.goal_mode] ?? "#6B7280",
  }));

  return (
    <div className="space-y-5">
      {/* Member Growth */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm">Member Growth (Last 6 Months)</p>
        </div>
        {growth.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={growth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6B7280" }} />
              <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "rgba(13,158,117,0.1)" }}
              />
              <Bar dataKey="new_members" name="New Members" fill="#0D9E75" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Revenue per Coach */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm">Revenue per Coach (OMR/mo)</p>
        </div>
        {coachRevenue.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No coaches with revenue yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, coachRevenue.length * 44)}>
            <BarChart data={coachRevenue} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#6B7280" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#9CA3AF" }} width={80} />
              <Tooltip
                contentStyle={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                formatter={(val: number) => [`${val} OMR`, "Est. Revenue"]}
              />
              <Bar dataKey="estimated_revenue" name="Revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {coachRevenue.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {coachRevenue.map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[140px]">{c.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{c.client_count} clients × {c.service_price} OMR</span>
                  <span className="font-semibold text-primary">{c.estimated_revenue} OMR</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Goal Distribution */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm">Member Goal Distribution</p>
        </div>
        {goals.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No data yet</p>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="60%" height={160}>
              <PieChart>
                <Pie data={goals} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                  {goals.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {goals.map(g => (
                <div key={g.goal_mode} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.fill }} />
                  <span className="text-xs text-muted-foreground flex-1">{g.name}</span>
                  <span className="text-xs font-semibold">{g.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Content Tab ───────────────────────────────────────────────────────────────
function ContentTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [section, setSection] = useState<"foods" | "exercises">("foods");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminFood | AdminExercise | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const foodsQuery = useQuery<AdminFood[]>({
    queryKey: ["admin", "foods", search],
    queryFn: () => customFetch<AdminFood[]>(`/api/admin/foods?q=${encodeURIComponent(search)}`),
    enabled: section === "foods",
  });

  const exercisesQuery = useQuery<AdminExercise[]>({
    queryKey: ["admin", "exercises", search],
    queryFn: () => customFetch<AdminExercise[]>(`/api/admin/exercises?q=${encodeURIComponent(search)}`),
    enabled: section === "exercises",
  });

  const deleteFoodMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/admin/foods/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "foods"] }); toast({ title: "Food deleted" }); },
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/admin/exercises/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "exercises"] }); toast({ title: "Exercise deleted" }); },
  });

  const saveFoodMutation = useMutation({
    mutationFn: (data: Record<string, string>) => {
      const body = {
        food_name: data["food_name"], food_group: data["food_group"],
        serving_unit: data["serving_unit"] || "per_100g",
        calories: Number(data["calories"]), protein_g: Number(data["protein_g"]),
        carbs_g: Number(data["carbs_g"]), fat_g: Number(data["fat_g"]),
        fibre_g: data["fibre_g"] ? Number(data["fibre_g"]) : undefined,
        dietary_tags: data["dietary_tags"] ? data["dietary_tags"].split(",").map(t => t.trim()).filter(Boolean) : [],
      };
      if (editing && "food_name" in editing)
        return customFetch(`/api/admin/foods/${editing.id}`, { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      return customFetch("/api/admin/foods", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "foods"] }); setEditing(null); setAdding(false); toast({ title: "Food saved" }); },
  });

  const saveExerciseMutation = useMutation({
    mutationFn: (data: Record<string, string>) => {
      const body = { name: data["name"], exercise_type: data["exercise_type"] || "strength", muscle_group: data["muscle_group"], equipment: data["equipment"], description: data["description"] || undefined };
      if (editing && "name" in editing)
        return customFetch(`/api/admin/exercises/${editing.id}`, { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      return customFetch("/api/admin/exercises", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "exercises"] }); setEditing(null); setAdding(false); toast({ title: "Exercise saved" }); },
  });

  const foods = foodsQuery.data ?? [];
  const exercises = exercisesQuery.data ?? [];
  const isFood = section === "foods";

  const openEdit = (item: AdminFood | AdminExercise) => {
    setEditing(item); setAdding(false);
    const f: Record<string, string> = {};
    Object.entries(item).forEach(([k, v]) => {
      if (Array.isArray(v)) f[k] = v.join(", ");
      else f[k] = String(v ?? "");
    });
    setForm(f);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => { setSection("foods"); setSearch(""); setEditing(null); setAdding(false); }}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${section === "foods" ? "bg-primary text-black" : "bg-card border border-border text-muted-foreground"}`}>
          <Utensils className="w-4 h-4 inline mr-1.5" />Foods
        </button>
        <button onClick={() => { setSection("exercises"); setSearch(""); setEditing(null); setAdding(false); }}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${section === "exercises" ? "bg-primary text-black" : "bg-card border border-border text-muted-foreground"}`}>
          <Dumbbell className="w-4 h-4 inline mr-1.5" />Exercises
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={`Search ${section}...`} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" className="h-10 gap-1 bg-primary text-black hover:bg-primary/90"
          onClick={() => { setEditing(null); setAdding(true); setForm({}); }}>
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>
      {!editing && !adding && (
        <p className="text-xs text-muted-foreground">{isFood ? foods.length : exercises.length} {isFood ? "foods" : "exercises"} shown</p>
      )}

      {(editing || adding) && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="font-semibold text-sm">{editing ? "Edit" : "Add"} {isFood ? "Food" : "Exercise"}</p>
          {isFood ? (
            <>
              <Input placeholder="Food name *" value={form["food_name"] ?? ""} onChange={e => setForm({ ...form, food_name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Food group (e.g. Proteins)" value={form["food_group"] ?? ""} onChange={e => setForm({ ...form, food_group: e.target.value })} />
                <select className="h-10 rounded-xl bg-background border border-input px-3 text-sm" value={form["serving_unit"] ?? "per_100g"} onChange={e => setForm({ ...form, serving_unit: e.target.value })}>
                  <option value="per_100g">Per 100g</option>
                  <option value="per_piece">Per piece</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Calories *" type="number" value={form["calories"] ?? ""} onChange={e => setForm({ ...form, calories: e.target.value })} />
                <Input placeholder="Protein (g)" type="number" value={form["protein_g"] ?? ""} onChange={e => setForm({ ...form, protein_g: e.target.value })} />
                <Input placeholder="Carbs (g)" type="number" value={form["carbs_g"] ?? ""} onChange={e => setForm({ ...form, carbs_g: e.target.value })} />
                <Input placeholder="Fat (g)" type="number" value={form["fat_g"] ?? ""} onChange={e => setForm({ ...form, fat_g: e.target.value })} />
                <Input placeholder="Fibre (g)" type="number" value={form["fibre_g"] ?? ""} onChange={e => setForm({ ...form, fibre_g: e.target.value })} />
              </div>
              <Input placeholder="Dietary tags (e.g. halal, vegan, gluten-free)" value={form["dietary_tags"] ?? ""} onChange={e => setForm({ ...form, dietary_tags: e.target.value })} />
              <div className="flex gap-2">
                <Button className="flex-1 h-9 bg-primary text-black hover:bg-primary/90" onClick={() => saveFoodMutation.mutate(form)} disabled={saveFoodMutation.isPending}>
                  {saveFoodMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
                <Button variant="outline" className="flex-1 h-9" onClick={() => { setEditing(null); setAdding(false); }}>Cancel</Button>
              </div>
            </>
          ) : (
            <>
              <Input placeholder="Exercise name *" value={form["name"] ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <select className="h-10 rounded-xl bg-background border border-input px-3 text-sm" value={form["exercise_type"] ?? "strength"} onChange={e => setForm({ ...form, exercise_type: e.target.value })}>
                  <option value="strength">Strength</option>
                  <option value="cardio">Cardio</option>
                  <option value="hiit">HIIT</option>
                  <option value="core">Core</option>
                  <option value="flexibility">Flexibility</option>
                  <option value="mobility">Mobility</option>
                  <option value="olympic">Olympic Lifting</option>
                </select>
                <Input placeholder="Muscle group (e.g. Chest)" value={form["muscle_group"] ?? ""} onChange={e => setForm({ ...form, muscle_group: e.target.value })} />
              </div>
              <Input placeholder="Equipment (e.g. Barbell, Dumbbell)" value={form["equipment"] ?? ""} onChange={e => setForm({ ...form, equipment: e.target.value })} />
              <Input placeholder="Description (optional)" value={form["description"] ?? ""} onChange={e => setForm({ ...form, description: e.target.value })} />
              <div className="flex gap-2">
                <Button className="flex-1 h-9 bg-primary text-black hover:bg-primary/90" onClick={() => saveExerciseMutation.mutate(form)} disabled={saveExerciseMutation.isPending}>
                  {saveExerciseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
                <Button variant="outline" className="flex-1 h-9" onClick={() => { setEditing(null); setAdding(false); }}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        {(isFood ? foodsQuery.isLoading : exercisesQuery.isLoading) ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : isFood ? (
          foods.map(food => (
            <div key={food.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{food.food_name}</p>
                  {food.food_group && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">{food.food_group}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {food.calories} kcal · P {food.protein_g}g · C {food.carbs_g}g · F {food.fat_g}g
                  {food.fibre_g ? ` · Fibre ${food.fibre_g}g` : ""}
                  {" · "}{food.serving_unit === "per_piece" ? "per piece" : "per 100g"}
                </p>
                {food.dietary_tags && food.dietary_tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {food.dietary_tags.map(tag => (
                      <span key={tag} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(food)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteFoodMutation.mutate(food.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          exercises.map(ex => (
            <div key={ex.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{ex.name}</p>
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md capitalize">{ex.exercise_type}</span>
                </div>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  {ex.muscle_group && (
                    <p className="text-xs text-muted-foreground">💪 {ex.muscle_group}</p>
                  )}
                  {ex.equipment && (
                    <p className="text-xs text-muted-foreground">🏋️ {ex.equipment}</p>
                  )}
                </div>
                {ex.description && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 truncate max-w-[220px]">{ex.description}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(ex)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteExerciseMutation.mutate(ex.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Logs Tab ──────────────────────────────────────────────────────────────────
interface ClickLog {
  id: number;
  userId: number | null;
  sessionId: string | null;
  eventType: string;
  elementTag: string | null;
  elementText: string | null;
  elementId: string | null;
  page: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

interface LogsResponse {
  logs: ClickLog[];
  total: number;
  page: number;
  limit: number;
}

function LogsTab() {
  const [page, setPage] = useState(1);
  const [filterUserId, setFilterUserId] = useState("");
  const [filterPage, setFilterPage] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (filterUserId) params.set("userId", filterUserId);

  const logsQuery = useQuery<LogsResponse>({
    queryKey: ["admin", "logs", page, filterUserId],
    queryFn: () => customFetch<LogsResponse>(`/api/admin/logs?${params}`),
    refetchInterval: 15000,
  });

  const clearMutation = useMutation({
    mutationFn: () => customFetch("/api/admin/logs?olderThanDays=7", { method: "DELETE" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "logs"] });
      toast({ title: `Cleared ${data?.deleted ?? 0} old log entries` });
    },
  });

  const logs = logsQuery.data?.logs ?? [];
  const total = logsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);
  const displayedLogs = filterPage ? logs.filter(l => l.page?.includes(filterPage)) : logs;

  const tagColor: Record<string, string> = {
    button: "bg-blue-500/20 text-blue-400",
    a: "bg-green-500/20 text-green-400",
    input: "bg-yellow-500/20 text-yellow-400",
    select: "bg-purple-500/20 text-purple-400",
    div: "bg-gray-500/20 text-gray-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{total.toLocaleString()} total events</span>
        </div>
        <Button variant="outline" size="sm" className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
          {clearMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Clear >7d"}
        </Button>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Filter by user ID..." value={filterUserId}
          onChange={e => { setFilterUserId(e.target.value); setPage(1); }} className="h-8 text-xs" />
        <Input placeholder="Filter by page..." value={filterPage}
          onChange={e => setFilterPage(e.target.value)} className="h-8 text-xs" />
      </div>

      {logsQuery.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : displayedLogs.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">No events found</div>
      ) : (
        <div className="space-y-2">
          {displayedLogs.map(log => (
            <div key={log.id} className="bg-card border border-border rounded-xl p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <MousePointerClick className="w-3.5 h-3.5 text-primary shrink-0" />
                  {log.elementTag && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${tagColor[log.elementTag] ?? "bg-muted text-muted-foreground"}`}>
                      {log.elementTag}
                    </span>
                  )}
                  {log.elementText && (
                    <span className="text-xs font-medium truncate max-w-[160px]">{log.elementText}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                {log.page && <span className="font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[160px]">{log.page}</span>}
                {(log.userName || log.userEmail) && (
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{log.userName || log.userEmail}</span>
                )}
                {!log.userId && <span className="text-amber-500">anonymous</span>}
                {log.elementId && <span className="font-mono text-[10px] text-muted-foreground">#{log.elementId}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: BarChart2 },
  { key: "members", label: "Members", icon: Users },
  { key: "coaches", label: "Coaches", icon: UserCheck },
  { key: "reports", label: "Reports", icon: TrendingUp },
  { key: "content", label: "Content", icon: Utensils },
  { key: "logs", label: "Logs", icon: Activity },
];

export default function AdminPanel() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { activeClient, setActiveClient } = useCoachClient();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const [showViewSearch, setShowViewSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: () => customFetch<AdminUser[]>("/api/admin/users"),
  });

  const handleViewUser = (u: AdminUser) => {
    setActiveClient({ id: u.id, name: u.full_name || u.email, email: u.email, mode: "admin" });
    setShowViewSearch(false);
    setSearchQuery("");
    setLocation("/dashboard");
  };

  const filteredUsers = (usersQuery.data ?? []).filter(u =>
    `${u.email} ${u.full_name ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mobile-container flex flex-col h-screen overflow-hidden bg-background">
      {activeClient?.mode === "admin" && (
        <div className="sticky top-0 z-20 bg-blue-600/90 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">Viewing: {activeClient.name}</span>
          </div>
          <button onClick={() => setActiveClient(null)} className="flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
      )}

      <header className="px-6 pb-4 flex items-start justify-between" style={{ paddingTop: activeClient?.mode === "admin" ? "1rem" : "3rem" }}>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{t("adminPanel.title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{user?.email}</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/coaches")}
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground border border-border/50 h-7 px-2">
              <Search className="w-3.5 h-3.5" />{t("dashboard.browse")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout.mutate()}
              className="text-xs gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 h-7 px-2">
              <LogOut className="w-3.5 h-3.5" />{t("common.signOut")}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setShowViewSearch(!showViewSearch)}
              className="text-xs gap-1.5 text-muted-foreground mt-1">
              <Eye className="w-3.5 h-3.5" /> {t("adminPanel.users.viewAsAdmin")}
            </Button>
            {showViewSearch && (
              <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-lg z-50">
                <div className="p-3">
                  <Input placeholder="Search users..." value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)} className="h-8 text-xs" autoFocus />
                </div>
                <div className="max-h-64 overflow-y-auto border-t border-border">
                  {usersQuery.isLoading ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">No users found</div>
                  ) : (
                    filteredUsers.map(u => (
                      <button key={u.id} onClick={() => handleViewUser(u)}
                        className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b border-border last:border-b-0 text-xs">
                        <p className="font-medium">{u.full_name || "—"}</p>
                        <p className="text-muted-foreground">{u.email}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tab bar — scrollable */}
      <div className="px-4 mb-4 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${tab === key ? "bg-primary text-black" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-6 pb-8">
        {tab === "overview" && <OverviewTab />}
        {tab === "members" && <MembersTab />}
        {tab === "coaches" && <CoachesTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "content" && <ContentTab />}
        {tab === "logs" && <LogsTab />}
      </main>
    </div>
  );
}
