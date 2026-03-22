import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Users, Dumbbell, Utensils, ChevronDown, ChevronUp, Shield, UserCheck, User, X, Plus, Search, LogOut, Pencil, Trash2, Eye, Activity, Clock, MousePointerClick, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCoachClient } from "@/context/coach-client-context";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

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
}

interface AdminCoach {
  id: number;
  email: string;
  full_name: string | null;
  client_count: number;
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
}

interface AdminExercise {
  id: number;
  name: string;
  exercise_type: string;
  muscle_group: string | null;
  equipment: string | null;
}

type Tab = "users" | "coaches" | "content" | "logs";

// ── Role badge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const cfg: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    admin: { label: "Admin", cls: "bg-primary/10 text-primary", icon: Shield },
    coach: { label: "Coach", cls: "bg-blue-500/10 text-blue-400", icon: UserCheck },
    member: { label: "Member", cls: "bg-muted text-muted-foreground", icon: User },
  };
  const { label, cls, icon: Icon } = cfg[role] ?? cfg.member;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ── Users tab ──────────────────────────────────────────────────────────────────
function UsersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast({ title: "Role updated" });
    },
    onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/admin/users/${id}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast({ title: "User deactivated" });
    },
    onError: () => toast({ title: "Failed to deactivate user", variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/admin/users/${id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast({ title: "User activated" });
    },
    onError: () => toast({ title: "Failed to activate user", variant: "destructive" }),
  });

  const users = (usersQuery.data ?? []).filter(u =>
    `${u.email} ${u.full_name ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {usersQuery.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className={`bg-card border border-card-border rounded-xl p-4 ${!user.is_active ? "opacity-60" : ""}`}>
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
                </div>
                <RoleBadge role={user.role} />
              </div>
              <div className="flex gap-2 flex-wrap">
                {user.role !== "member" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2"
                    onClick={() => changeRoleMutation.mutate({ id: user.id, role: "member" })}
                    disabled={changeRoleMutation.isPending || !user.is_active}
                  >
                    <User className="w-3 h-3 mr-1" /> Set Member
                  </Button>
                )}
                {user.role !== "coach" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2"
                    onClick={() => changeRoleMutation.mutate({ id: user.id, role: "coach" })}
                    disabled={changeRoleMutation.isPending || !user.is_active}
                  >
                    <UserCheck className="w-3 h-3 mr-1" /> Set Coach
                  </Button>
                )}
                {user.role !== "admin" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2 text-primary border-primary/30 hover:bg-primary/10"
                    onClick={() => changeRoleMutation.mutate({ id: user.id, role: "admin" })}
                    disabled={changeRoleMutation.isPending || !user.is_active}
                  >
                    <Shield className="w-3 h-3 mr-1" /> Set Admin
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 px-2 text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
                  onClick={() => {
                    setActiveClient({ id: user.id, name: user.full_name || user.email, email: user.email, mode: "admin" });
                    setLocation("/dashboard");
                  }}
                  disabled={!user.is_active}
                >
                  <Eye className="w-3 h-3 mr-1" /> View
                </Button>
                {user.is_active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => deactivateMutation.mutate(user.id)}
                    disabled={deactivateMutation.isPending || activateMutation.isPending}
                  >
                    {deactivateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <X className="w-3 h-3 mr-1" />} Deactivate
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2 text-green-400 border-green-400/30 hover:bg-green-400/10"
                    onClick={() => activateMutation.mutate(user.id)}
                    disabled={activateMutation.isPending || deactivateMutation.isPending}
                  >
                    {activateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />} Activate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Coaches tab ────────────────────────────────────────────────────────────────
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      setAssigningTo(null);
      toast({ title: "Client assigned" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ coachId, clientId }: { coachId: number; clientId: number }) =>
      customFetch(`/api/admin/coaches/${coachId}/clients/${clientId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast({ title: "Client removed" });
    },
  });

  const coaches = coachesQuery.data ?? [];
  const members = (membersQuery.data ?? []).filter(m =>
    !m.coach_id &&
    `${m.email} ${m.full_name ?? ""}`.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {coachesQuery.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : coaches.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">No coaches yet. Promote a member to Coach from the Users tab.</div>
      ) : (
        coaches.map(coach => (
          <div key={coach.id} className="bg-card border border-card-border rounded-xl">
            <button
              className="w-full flex items-center justify-between p-4"
              onClick={() => setExpandedCoach(expandedCoach === coach.id ? null : coach.id)}
            >
              <div className="text-left">
                <p className="font-medium text-sm">{coach.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground">{coach.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{coach.client_count} clients</span>
                {expandedCoach === coach.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {expandedCoach === coach.id && (
              <div className="border-t border-card-border px-4 pb-4 pt-3 space-y-2">
                {coach.clients.length === 0 && (
                  <p className="text-xs text-muted-foreground">No clients assigned yet.</p>
                )}
                {coach.clients.map(client => (
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8 mt-2 gap-1"
                    onClick={() => { setAssigningTo(coach.id); setMemberSearch(""); }}
                  >
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

// ── Content tab ────────────────────────────────────────────────────────────────
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
        food_name: data["food_name"], food_group: data["food_group"], serving_unit: data["serving_unit"] || "per_100g",
        calories: Number(data["calories"]), protein_g: Number(data["protein_g"]),
        carbs_g: Number(data["carbs_g"]), fat_g: Number(data["fat_g"]),
      };
      if (editing && "food_name" in editing) {
        return customFetch(`/api/admin/foods/${editing.id}`, { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      }
      return customFetch("/api/admin/foods", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "foods"] }); setEditing(null); setAdding(false); toast({ title: "Food saved" }); },
  });

  const saveExerciseMutation = useMutation({
    mutationFn: (data: Record<string, string>) => {
      const body = { name: data["name"], exercise_type: data["exercise_type"] || "strength", muscle_group: data["muscle_group"], equipment: data["equipment"] };
      if (editing && "name" in editing) {
        return customFetch(`/api/admin/exercises/${editing.id}`, { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      }
      return customFetch("/api/admin/exercises", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "exercises"] }); setEditing(null); setAdding(false); toast({ title: "Exercise saved" }); },
  });

  const foods = foodsQuery.data ?? [];
  const exercises = exercisesQuery.data ?? [];

  const openEdit = (item: AdminFood | AdminExercise) => {
    setEditing(item);
    setAdding(false);
    const f: Record<string, string> = {};
    Object.entries(item).forEach(([k, v]) => { f[k] = String(v ?? ""); });
    setForm(f);
  };

  const openAdd = () => {
    setEditing(null);
    setAdding(true);
    setForm({});
  };

  const isFood = section === "foods";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => { setSection("foods"); setSearch(""); setEditing(null); setAdding(false); }}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${section === "foods" ? "bg-primary text-black" : "bg-card border border-card-border text-muted-foreground"}`}
        >
          <Utensils className="w-4 h-4 inline mr-1.5" />Foods
        </button>
        <button
          onClick={() => { setSection("exercises"); setSearch(""); setEditing(null); setAdding(false); }}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${section === "exercises" ? "bg-primary text-black" : "bg-card border border-card-border text-muted-foreground"}`}
        >
          <Dumbbell className="w-4 h-4 inline mr-1.5" />Exercises
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={`Search ${section}...`} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" className="h-10 gap-1 bg-primary text-black hover:bg-primary/90" onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      {(editing || adding) && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <p className="font-semibold text-sm">{editing ? "Edit" : "Add"} {isFood ? "Food" : "Exercise"}</p>
          {isFood ? (
            <>
              <Input placeholder="Food name *" value={form["food_name"] ?? ""} onChange={e => setForm({ ...form, food_name: e.target.value })} />
              <Input placeholder="Food group" value={form["food_group"] ?? ""} onChange={e => setForm({ ...form, food_group: e.target.value })} />
              <select className="w-full h-10 rounded-xl bg-background border border-input px-3 text-sm" value={form["serving_unit"] ?? "per_100g"} onChange={e => setForm({ ...form, serving_unit: e.target.value })}>
                <option value="per_100g">Per 100g</option>
                <option value="per_piece">Per piece</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Calories *" type="number" value={form["calories"] ?? ""} onChange={e => setForm({ ...form, calories: e.target.value })} />
                <Input placeholder="Protein (g)" type="number" value={form["protein_g"] ?? ""} onChange={e => setForm({ ...form, protein_g: e.target.value })} />
                <Input placeholder="Carbs (g)" type="number" value={form["carbs_g"] ?? ""} onChange={e => setForm({ ...form, carbs_g: e.target.value })} />
                <Input placeholder="Fat (g)" type="number" value={form["fat_g"] ?? ""} onChange={e => setForm({ ...form, fat_g: e.target.value })} />
              </div>
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
              <select className="w-full h-10 rounded-xl bg-background border border-input px-3 text-sm" value={form["exercise_type"] ?? "strength"} onChange={e => setForm({ ...form, exercise_type: e.target.value })}>
                <option value="strength">Strength</option>
                <option value="cardio">Cardio</option>
              </select>
              <Input placeholder="Muscle group" value={form["muscle_group"] ?? ""} onChange={e => setForm({ ...form, muscle_group: e.target.value })} />
              <Input placeholder="Equipment" value={form["equipment"] ?? ""} onChange={e => setForm({ ...form, equipment: e.target.value })} />
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
            <div key={food.id} className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{food.food_name}</p>
                <p className="text-xs text-muted-foreground">{food.calories} kcal · {food.serving_unit === "per_piece" ? "per piece" : "per 100g"}</p>
              </div>
              <div className="flex gap-1">
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
            <div key={ex.id} className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{ex.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{ex.exercise_type}{ex.muscle_group ? ` · ${ex.muscle_group}` : ""}</p>
              </div>
              <div className="flex gap-1">
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

// ── Logs Tab ───────────────────────────────────────────────────────────────────
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

  const displayedLogs = filterPage
    ? logs.filter(l => l.page?.includes(filterPage))
    : logs;

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString();
  }

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
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => clearMutation.mutate()}
          disabled={clearMutation.isPending}
        >
          {clearMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Clear >7d"}
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Filter by user ID..."
          value={filterUserId}
          onChange={e => { setFilterUserId(e.target.value); setPage(1); }}
          className="h-8 text-xs"
        />
        <Input
          placeholder="Filter by page..."
          value={filterPage}
          onChange={e => setFilterPage(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {logsQuery.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : displayedLogs.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">No events found</div>
      ) : (
        <div className="space-y-2">
          {displayedLogs.map(log => (
            <div key={log.id} className="bg-card border border-card-border rounded-xl p-3 space-y-1.5">
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
                  {formatTime(log.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                {log.page && (
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[160px]">{log.page}</span>
                )}
                {(log.userName || log.userEmail) && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {log.userName || log.userEmail}
                  </span>
                )}
                {!log.userId && (
                  <span className="text-amber-500">anonymous</span>
                )}
                {log.elementId && (
                  <span className="font-mono text-[10px] text-muted-foreground">#{log.elementId}</span>
                )}
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

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user, logout } = useAuth();
  const { activeClient, setActiveClient } = useCoachClient();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("users");
  const [showViewSearch, setShowViewSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: () => customFetch<AdminUser[]>("/api/admin/users"),
  });

  const handleStopViewing = () => {
    setActiveClient(null);
  };

  const handleViewUser = (user: AdminUser) => {
    setActiveClient({
      id: user.id,
      name: user.full_name || user.email,
      email: user.email,
      mode: "admin",
    });
    setShowViewSearch(false);
    setSearchQuery("");
    setLocation("/dashboard");
  };

  const filteredUsers = (usersQuery.data ?? []).filter(u =>
    `${u.email} ${u.full_name ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mobile-container flex flex-col h-screen overflow-hidden bg-background">
      {activeClient && activeClient.mode === "admin" && (
        <div className="sticky top-0 z-20 bg-blue-600/90 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">Viewing: {activeClient.name}</span>
          </div>
          <button
            onClick={handleStopViewing}
            className="flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
      )}
      <header className="px-6 pt-12 pb-4 flex items-start justify-between" style={{ paddingTop: activeClient?.mode === "admin" ? "1rem" : "3rem" }}>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          </div>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowViewSearch(!showViewSearch)}
              className="text-xs gap-1.5 text-muted-foreground mt-1"
            >
              <Eye className="w-3.5 h-3.5" /> View
            </Button>
            {showViewSearch && (
              <div className="absolute right-0 mt-2 w-64 bg-card border border-card-border rounded-xl shadow-lg z-50">
                <div className="p-3">
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-8 text-xs"
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto border-t border-card-border">
                  {usersQuery.isLoading ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">No users found</div>
                  ) : (
                    filteredUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleViewUser(u)}
                        className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b border-card-border last:border-b-0 text-xs"
                      >
                        <p className="font-medium">{u.full_name || "—"}</p>
                        <p className="text-muted-foreground text-xs">{u.email}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => logout.mutate()} className="text-xs gap-1.5 text-muted-foreground mt-1">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-6 flex gap-2 mb-4 flex-wrap">
        {(["users", "coaches", "content", "logs"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${tab === t ? "bg-primary text-black" : "bg-card border border-card-border text-muted-foreground"}`}
          >
            {t === "logs" ? "📋 Logs" : t}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-6 pb-8">
        {tab === "users" && <UsersTab />}
        {tab === "coaches" && <CoachesTab />}
        {tab === "content" && <ContentTab />}
        {tab === "logs" && <LogsTab />}
      </main>
    </div>
  );
}
