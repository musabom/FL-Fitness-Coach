import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/language-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, Plus, Trash2, Pencil, Check, X, Search, Loader2, AlertTriangle, MessageSquare } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import BottomNav from "@/components/bottom-nav";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FoodResult {
  id: number;
  food_name: string;
  food_group: string;
  cooking_method: string;
  serving_unit: string;
  serving_weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  leucine_g: number;
  dietary_tags: string[];
  source?: "database" | "user";
}

interface Portion {
  id: number;
  food_id: number;
  food_name: string;
  cooking_method: string;
  serving_unit: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes?: string | null;
}

interface MealTotals {
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
}

interface Meal {
  id: number;
  meal_name: string;
  scheduled_days: string[];
  portions: Portion[];
  totals: MealTotals;
}

interface DailyTotals {
  day: string;
  totals: MealTotals;
  targets: { calorie_target: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  progress: { calories_pct: number; protein_pct: number; carbs_pct: number; fat_pct: number };
  warnings: string[];
}

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun"
};

// ── Progress bar ──────────────────────────────────────────────────────────────

function MacroBar({ label, current, target, unit }: { label: string; current: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 110) : 0;
  const ceiling = target * 1.03;
  const warn = target * 0.9;
  const color = current > ceiling ? "bg-red-500" : current >= warn ? "bg-amber-400" : "bg-green-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span>
        <span>{Math.round(current).toLocaleString()} / {Math.round(target).toLocaleString()} {unit}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

// ── Create Custom Food Form ───────────────────────────────────────────────────

function CreateCustomFoodForm({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [foodName, setFoodName] = useState("");
  const [servingUnit, setServingUnit] = useState<"per_100g" | "per_piece">("per_100g");
  const [servingWeightG, setServingWeightG] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      customFetch(`${BASE}/foods/custom`, {
        method: "POST",
        body: JSON.stringify({
          food_name: foodName.trim(),
          serving_unit: servingUnit,
          serving_weight_g: servingUnit === "per_piece" ? Number(servingWeightG) || 1 : null,
          calories: Number(calories),
          protein_g: Number(protein),
          carbs_g: Number(carbs),
          fat_g: Number(fat),
        }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foods-search"] });
      onSuccess();
    },
  });

  const canCreate = foodName.trim() && calories && protein && carbs && fat &&
    (servingUnit === "per_100g" || (servingUnit === "per_piece" && servingWeightG));

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to search
      </button>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Food Name</label>
          <Input
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
            placeholder="e.g., Grilled Chicken Breast"
            className="bg-[#1A1A1A] border-border/50"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">Serving Unit</label>
          <div className="flex gap-2">
            {(["per_100g", "per_piece"] as const).map(unit => (
              <button
                key={unit}
                onClick={() => setServingUnit(unit)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  servingUnit === unit
                    ? "bg-primary text-black"
                    : "bg-[#1A1A1A] border border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {unit === "per_100g" ? "Per 100g" : "Per Piece"}
              </button>
            ))}
          </div>
        </div>

        {servingUnit === "per_piece" && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Weight per Piece (g)</label>
            <Input
              type="number"
              value={servingWeightG}
              onChange={(e) => setServingWeightG(e.target.value)}
              placeholder="e.g., 150"
              className="bg-[#1A1A1A] border-border/50"
            />
          </div>
        )}

        {/* Nutrition fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Calories</label>
            <Input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="0"
              className="bg-[#1A1A1A] border-border/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Protein (g)</label>
            <Input
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              placeholder="0"
              step="0.1"
              className="bg-[#1A1A1A] border-border/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Carbs (g)</label>
            <Input
              type="number"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              placeholder="0"
              step="0.1"
              className="bg-[#1A1A1A] border-border/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Fat (g)</label>
            <Input
              type="number"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              placeholder="0"
              step="0.1"
              className="bg-[#1A1A1A] border-border/50"
            />
          </div>
        </div>

        {/* Create button */}
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!canCreate || createMutation.isPending}
          className="w-full"
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Custom Food"
          )}
        </Button>

        {createMutation.isError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            {(createMutation.error as any)?.message || "Failed to create food"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Food Search Sheet ─────────────────────────────────────────────────────────

function FoodSearchSheet({
  mealId,
  onClose,
  onAdded,
}: {
  mealId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [qty, setQty] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterSource, setFilterSource] = useState<"all" | "custom" | "database">("all");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: foods, isFetching } = useQuery<FoodResult[]>({
    queryKey: ["foods-search", debouncedQ],
    queryFn: () => customFetch(`${BASE}/foods/search?q=${encodeURIComponent(debouncedQ)}`),
    enabled: !selected,
    staleTime: 10_000,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      customFetch(`${BASE}/meals/${mealId}/portions`, {
        method: "POST",
        body: JSON.stringify({ food_id: selected!.id, quantity_g: Number(qty), food_source: selected!.source || "database" }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => { onAdded(); onClose(); },
  });

  const qtyNum = Number(qty);
  const canAdd = selected !== null && qtyNum > 0;

  let previewMultiplier = 0;
  if (selected && qtyNum > 0) {
    previewMultiplier = selected.serving_unit === "per_piece"
      ? qtyNum
      : qtyNum / 100;
  }
  const preview = selected ? {
    calories: (selected.calories * previewMultiplier).toFixed(1),
    protein_g: (selected.protein_g * previewMultiplier).toFixed(1),
    carbs_g: (selected.carbs_g * previewMultiplier).toFixed(1),
    fat_g: (selected.fat_g * previewMultiplier).toFixed(1),
  } : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#141414] border-t border-border rounded-t-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <h3 className="font-semibold text-lg">Add Food</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 shrink-0 border-b border-border/50 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search foods..."
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); }}
              className="pl-9"
            />
          </div>
          
          {/* Filter tabs */}
          <div className="flex gap-2">
            {(["all", "database", "custom"] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setFilterSource(filter)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  filterSource === filter
                    ? "bg-primary text-black"
                    : "bg-[#1A1A1A] border border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter === "all" ? "All Foods" : filter === "database" ? "Database" : "My Custom"}
              </button>
            ))}
          </div>
        </div>

        {/* Results list - scrollable below search */}
        {!selected && !showCreateForm && (
          <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
            {isFetching && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}
            {!isFetching && debouncedQ && !foods?.length && (
              <div className="space-y-3 py-6">
                <p className="text-center text-muted-foreground text-sm">No foods found for "{debouncedQ}"</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 transition-all text-primary font-medium text-sm"
                >
                  + Add Custom Food
                </button>
              </div>
            )}
            <div className="space-y-2">
              {foods
                ?.filter(food => {
                  if (filterSource === "all") return true;
                  if (filterSource === "custom") return food.source === "user";
                  if (filterSource === "database") return food.source === "database";
                  return true;
                })
                .map(food => (
                <button
                  key={`${food.id}-${food.source}`}
                  onClick={() => { setSelected(food); setQty(""); }}
                  className="w-full text-left p-3 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] active:scale-[0.99] transition-all border border-border/50"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{food.food_name}</span>
                        {food.source === "user" && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded">Custom</span>}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize mt-0.5">{food.cooking_method.replace(/_/g, " ")}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground ml-4 shrink-0">
                      <div className="grid grid-cols-4 gap-2 text-foreground font-medium">
                        <div className="flex flex-col items-center">
                          <div className="text-xs">{Math.round(food.calories)}</div>
                          <div className="text-[10px] text-muted-foreground">Cal</div>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="text-xs">{food.protein_g.toFixed(1)}</div>
                          <div className="text-[10px] text-muted-foreground">P</div>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="text-xs">{food.carbs_g.toFixed(1)}</div>
                          <div className="text-[10px] text-muted-foreground">C</div>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="text-xs">{food.fat_g.toFixed(1)}</div>
                          <div className="text-[10px] text-muted-foreground">F</div>
                        </div>
                      </div>
                      <div className="text-muted-foreground/60 text-xs mt-1">{food.serving_unit === "per_piece" ? "per piece" : "per 100g"}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Create custom food form */}
        {showCreateForm && (
          <CreateCustomFoodForm
            onBack={() => setShowCreateForm(false)}
            onSuccess={() => {
              setShowCreateForm(false);
              queryClient.invalidateQueries({ queryKey: ["foods-search", debouncedQ] });
            }}
          />
        )}

        {/* Quantity input after selection */}
        {selected && !showCreateForm && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" /> Back to results
            </button>

            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-border/50">
              <div className="font-semibold">{selected.food_name}</div>
              <div className="text-xs text-muted-foreground capitalize">{selected.cooking_method.replace(/_/g, " ")} · {selected.food_group}</div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {selected.serving_unit === "per_piece" ? "Number of pieces" : "Quantity (grams)"}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  className="text-xl h-14 pl-4 pr-16 font-light"
                  placeholder={selected.serving_unit === "per_piece" ? "1" : "100"}
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  autoFocus
                  min="0.1"
                  step="0.1"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {selected.serving_unit === "per_piece" ? "pcs" : "g"}
                </span>
              </div>
            </div>

            {preview && qtyNum > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Calories", val: preview.calories, unit: "kcal" },
                  { label: "Protein", val: preview.protein_g, unit: "g" },
                  { label: "Carbs", val: preview.carbs_g, unit: "g" },
                  { label: "Fat", val: preview.fat_g, unit: "g" },
                ].map(m => (
                  <div key={m.label} className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-center">
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className="text-sm font-semibold text-primary">{m.val}</div>
                    <div className="text-xs text-muted-foreground">{m.unit}</div>
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!canAdd || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add to Meal
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Portion Row ───────────────────────────────────────────────────────────────

function PortionRow({ portion, mealId, onDelete, onUpdated }: {
  portion: Portion;
  mealId: number;
  onDelete: () => void;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [qtyVal, setQtyVal] = useState(String(portion.quantity_g));
  const [showNote, setShowNote] = useState(false);
  const [noteVal, setNoteVal] = useState(portion.notes ?? "");

  useEffect(() => {
    setNoteVal(portion.notes ?? "");
  }, [portion.notes]);

  const deleteMutation = useMutation({
    mutationFn: () => customFetch(`${BASE}/meals/${mealId}/portions/${portion.id}`, { method: "DELETE" }),
    onSuccess: onDelete,
  });

  const updateMutation = useMutation({
    mutationFn: (body: { quantity_g: number; notes?: string | null }) =>
      customFetch(`${BASE}/meals/${mealId}/portions/${portion.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => { setEditing(false); onUpdated(); },
  });

  const saveNote = () => {
    updateMutation.mutate({ quantity_g: portion.quantity_g, notes: noteVal.trim() || null });
  };

  const unitLabel = portion.serving_unit === "per_piece" ? "pcs" : "g";

  return (
    <div className="border-b border-border/30 last:border-0">
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{portion.food_name}</div>
          <div className="text-xs text-muted-foreground capitalize">{portion.cooking_method?.replace(/_/g, " ")} · {portion.quantity_g}{unitLabel}</div>
        </div>

        {editing ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Input
              type="number"
              className="h-7 w-20 text-sm px-2"
              value={qtyVal}
              onChange={e => setQtyVal(e.target.value)}
              min="0.1"
              step="0.1"
              autoFocus
            />
            <span className="text-xs text-muted-foreground">{unitLabel}</span>
            <button
              onClick={() => updateMutation.mutate({ quantity_g: Number(qtyVal), notes: noteVal.trim() || null })}
              disabled={updateMutation.isPending}
              className="w-6 h-6 flex items-center justify-center text-green-500 hover:bg-green-500/10 rounded"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setEditing(false); setQtyVal(String(portion.quantity_g)); }}
              className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:bg-muted rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <div className="grid grid-cols-4 gap-x-2 text-right text-xs shrink-0">
              <div>
                <div className="text-foreground font-medium">{Math.round(portion.calories)}</div>
                <div className="text-muted-foreground">Cal</div>
              </div>
              <div>
                <div className="text-foreground font-medium">{portion.protein_g.toFixed(1)}</div>
                <div className="text-muted-foreground">P</div>
              </div>
              <div>
                <div className="text-foreground font-medium">{portion.carbs_g.toFixed(1)}</div>
                <div className="text-muted-foreground">C</div>
              </div>
              <div>
                <div className="text-foreground font-medium">{portion.fat_g.toFixed(1)}</div>
                <div className="text-muted-foreground">F</div>
              </div>
            </div>
            <button
              onClick={() => setShowNote(v => !v)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors ${portion.notes ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Add note"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setEditing(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {showNote && (
        <div className="pb-2 px-0 flex items-center gap-2">
          <Input
            className="h-7 text-xs"
            placeholder="Add a note (e.g. post-workout)"
            value={noteVal}
            onChange={e => setNoteVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { saveNote(); setShowNote(false); } if (e.key === "Escape") { setNoteVal(portion.notes ?? ""); setShowNote(false); } }}
            onBlur={e => {
              if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest("[data-note-actions]")) return;
              saveNote();
              setShowNote(false);
            }}
            autoFocus
          />
          <div data-note-actions className="flex items-center gap-1 shrink-0">
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => { saveNote(); setShowNote(false); }}
              disabled={updateMutation.isPending}
              className="w-6 h-6 flex items-center justify-center text-green-500 hover:bg-green-500/10 rounded"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setNoteVal(portion.notes ?? ""); setShowNote(false); }}
              className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:bg-muted rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {!showNote && portion.notes && (
        <div className="pb-2 text-xs text-muted-foreground italic">{portion.notes}</div>
      )}
    </div>
  );
}

// ── Meal Card ─────────────────────────────────────────────────────────────────

function MealCard({ meal, onRefresh, dailyCalorieTarget }: {
  meal: Meal;
  onRefresh: () => void;
  dailyCalorieTarget: number;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(meal.meal_name);
  const [showSearch, setShowSearch] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      customFetch(`${BASE}/meals/${meal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ meal_name: name }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => { setEditingName(false); onRefresh(); },
  });

  const scheduleMutation = useMutation({
    mutationFn: (days: string[]) =>
      customFetch(`${BASE}/meals/${meal.id}/schedule`, {
        method: "POST",
        body: JSON.stringify({ days }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: onRefresh,
  });

  const deleteMealMutation = useMutation({
    mutationFn: () => customFetch(`${BASE}/meals/${meal.id}`, { method: "DELETE" }),
    onSuccess: onRefresh,
  });

  const toggleDay = (day: string) => {
    const current = meal.scheduled_days ?? [];
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    scheduleMutation.mutate(next);
  };

  return (
    <>
      <Card className="border-border/50 bg-[#141414] p-0 overflow-hidden">
        {/* Card header */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2 border-b border-border/30">
          {editingName ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                className="h-8 text-sm"
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && renameMutation.mutate(nameVal)}
                autoFocus
              />
              <button
                onClick={() => renameMutation.mutate(nameVal)}
                disabled={renameMutation.isPending}
                className="text-green-500 hover:text-green-400"
              >
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => { setEditingName(false); setNameVal(meal.meal_name); }}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setExpanded(!expanded)}
              className="font-semibold text-left hover:text-primary transition-colors flex items-center gap-1.5 flex-1"
            >
              {meal.meal_name}
              <Pencil 
                className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-primary" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setEditingName(true); 
                }} 
              />
            </button>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{Math.round(meal.totals.calories)}</span> kcal
            </div>
            <button
              onClick={() => deleteMealMutation.mutate()}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Macro summary */}
        <div className="grid grid-cols-3 gap-0 border-b border-border/30">
          {[
            { label: "Protein", val: meal.totals.protein_g, unit: "g" },
            { label: "Carbs", val: meal.totals.carbs_g, unit: "g" },
            { label: "Fat", val: meal.totals.fat_g, unit: "g" },
          ].map((m, i) => (
            <div key={m.label} className={`py-2.5 text-center ${i < 2 ? "border-r border-border/30" : ""}`}>
              <div className="text-xs text-muted-foreground">{m.label}</div>
              <div className="text-sm font-semibold">{m.val.toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-0.5">{m.unit}</span></div>
            </div>
          ))}
        </div>

        {/* Portions list (collapsible) */}
        {expanded && (
          <div className="px-4 py-1 border-t border-border/30">
            {meal.portions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No foods added yet</p>
            )}
            {meal.portions.map(portion => (
              <PortionRow
                key={portion.id}
                portion={portion}
                mealId={meal.id}
                onDelete={onRefresh}
                onUpdated={onRefresh}
              />
            ))}
          </div>
        )}

        {/* Tap to expand hint if collapsed */}
        {!expanded && meal.portions.length > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full text-center text-[10px] text-muted-foreground/50 py-2 hover:text-muted-foreground transition-colors border-t border-border/30"
          >
            {meal.portions.length} food{meal.portions.length !== 1 ? "s" : ""} · tap to view
          </button>
        )}

        {/* Add portion button */}
        <div className="px-4 pb-3">
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-border hover:border-primary/50 hover:text-primary text-muted-foreground text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Food
          </button>
        </div>

        {/* Day selector */}
        <div className="px-4 pb-4 border-t border-border/30 pt-3">
          <div className="text-xs text-muted-foreground mb-2">Scheduled Days</div>
          <div className="flex gap-1.5">
            {DAYS.map(day => {
              const active = (meal.scheduled_days ?? []).includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {showSearch && (
        <FoodSearchSheet
          mealId={meal.id}
          onClose={() => setShowSearch(false)}
          onAdded={onRefresh}
        />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NutritionMeals() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [dismissedWarnings, setDismissedWarnings] = useState(false);

  const mealsQuery = useQuery<Meal[]>({
    queryKey: ["meals"],
    queryFn: () => customFetch(`${BASE}/meals`),
  });

  const dailyQuery = useQuery<DailyTotals>({
    queryKey: ["meals-daily-totals"],
    queryFn: () => customFetch(`${BASE}/meals/daily-totals`),
  });

  const createMealMutation = useMutation({
    mutationFn: () =>
      customFetch(`${BASE}/meals`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      queryClient.invalidateQueries({ queryKey: ["meals-daily-totals"] });
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["meals"] });
    queryClient.invalidateQueries({ queryKey: ["meals-daily-totals"] });
    setDismissedWarnings(false);
  };

  const daily = dailyQuery.data;
  const meals = mealsQuery.data ?? [];
  const warnings = daily?.warnings ?? [];
  const targets = daily?.targets;
  const totals = daily?.totals;

  const isLoading = mealsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="mobile-container flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="mobile-container flex flex-col min-h-screen overflow-y-auto scrollbar-none pb-24">
      {/* Header */}
      <header className="sticky top-0 bg-background/80 backdrop-blur-xl z-10 border-b border-border/50 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard">
          <button className="w-9 h-9 flex items-center justify-center rounded-full border border-border hover:bg-muted">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-xl font-semibold flex-1">{t("nutritionMeals.title")}</h1>
      </header>

      <main className="px-4 pt-4 space-y-4">
        {/* Warnings banner */}
        {warnings.length > 0 && !dismissedWarnings && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-300">{w}</p>
              ))}
            </div>
            <button
              onClick={() => setDismissedWarnings(true)}
              className="text-amber-400/70 hover:text-amber-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Meal cards */}
        {meals.map(meal => (
          <MealCard
            key={meal.id}
            meal={meal}
            onRefresh={refresh}
            dailyCalorieTarget={targets?.calorie_target ?? 2000}
          />
        ))}

        {/* Add meal */}
        <Button
          onClick={() => createMealMutation.mutate()}
          disabled={createMealMutation.isPending}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-sm gap-2"
        >
          {createMealMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Add Meal
        </Button>

        {meals.length === 0 && !mealsQuery.isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm mb-1">No meals yet</p>
            <p className="text-muted-foreground/60 text-xs">Tap "Add Meal" to get started</p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
