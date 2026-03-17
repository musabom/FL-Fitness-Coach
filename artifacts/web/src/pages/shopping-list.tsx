import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ChevronLeft, ShoppingCart, Package, TrendingDown,
  CheckCircle2, AlertCircle, Edit3, Check, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShoppingItem {
  food_id: number;
  food_source: string;
  food_name: string;
  food_group: string;
  serving_unit: string;
  weekly_quantity: number;  // in native unit (pieces or grams)
  stock_g: number;
  needed_g: number;
  meals: { meal_id: number; meal_name: string; quantity_g: number; days_per_week: number }[];
}

// ── Stock Editor ──────────────────────────────────────────────────────────────

function StockEditor({
  item,
  onSaved,
}: {
  item: ShoppingItem;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(Math.round(item.stock_g)));
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setVal(String(Math.round(item.stock_g)));
  }, [item.stock_g]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: (qty: number) =>
      customFetch(`${BASE}/shopping-list/stock`, {
        method: "PUT",
        body: JSON.stringify({
          food_id: item.food_id,
          food_source: item.food_source,
          food_name: item.food_name,
          quantity_g: qty,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
      setEditing(false);
      onSaved();
    },
  });

  const save = () => {
    const qty = Math.max(0, Number(val) || 0);
    saveMutation.mutate(qty);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <Input
          ref={inputRef}
          type="number"
          min="0"
          step="10"
          className="h-7 w-24 text-sm px-2"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setEditing(false); setVal(String(Math.round(item.stock_g))); }
          }}
        />
        <span className="text-xs text-muted-foreground">g</span>
        <button
          onClick={save}
          disabled={saveMutation.isPending}
          className="w-6 h-6 flex items-center justify-center text-green-500 hover:bg-green-500/10 rounded"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { setEditing(false); setVal(String(Math.round(item.stock_g))); }}
          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:bg-muted rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground hover:text-foreground transition-colors group"
    >
      <span className={item.stock_g > 0 ? "text-primary font-medium" : ""}>
        {Math.round(item.stock_g)}g
      </span>
      <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ── Shopping Item Card ────────────────────────────────────────────────────────

function ItemCard({ item }: { item: ShoppingItem }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const stockPct = item.weekly_g > 0 ? Math.min((item.stock_g / item.weekly_g) * 100, 100) : 100;
  const sufficient = item.needed_g === 0;

  return (
    <Card className={`bg-[#1A1A1A] border-border/40 overflow-hidden transition-all ${sufficient ? "border-l-2 border-l-primary/30" : "border-l-2 border-l-amber-500/60"}`}>
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Status icon */}
        <div className="shrink-0 mt-0.5">
          {sufficient
            ? <CheckCircle2 className="w-4 h-4 text-primary" />
            : <AlertCircle className="w-4 h-4 text-amber-500" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{item.food_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {item.serving_unit === "per_piece" 
                ? `${Math.round(item.weekly_quantity)} pc${Math.round(item.weekly_quantity) !== 1 ? "s" : ""}/week`
                : `${Math.round(item.weekly_quantity)}g/week`}
            </span>
          </div>

          {/* Stock progress bar */}
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Stock</span>
              <span className={sufficient ? "text-primary" : "text-amber-500"}>
                {sufficient ? "Sufficient" : `Need ${Math.round(item.needed_g)}g more`}
              </span>
            </div>
            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${sufficient ? "bg-primary" : "bg-amber-500"}`}
                style={{ width: `${stockPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stock editor + expand */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StockEditor item={item} onSaved={() => queryClient.invalidateQueries({ queryKey: ["shopping-list"] })} />
          {item.meals.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded
                ? <ChevronUp className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded meal breakdown */}
      {expanded && (
        <div className="border-t border-border/30 px-4 py-3 space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Used in meals</p>
          {item.meals.map((m) => (
            <div key={m.meal_id} className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate flex-1">{m.meal_name}</span>
              <span className="shrink-0 tabular-nums ml-2">
                {Math.round(m.quantity_g)}g × {m.days_per_week}d/wk = {Math.round(m.quantity_g * m.days_per_week)}g/wk
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ShoppingList() {
  const [filter, setFilter] = useState<"all" | "needed" | "sufficient">("all");

  const { data: items = [], isLoading, isError } = useQuery<ShoppingItem[]>({
    queryKey: ["shopping-list"],
    queryFn: () => customFetch(`${BASE}/shopping-list`),
  });

  // Filter items by weekly_quantity > 0 (only in meal plan)
  const filtered = items.filter(item => {
    if (item.weekly_quantity === 0) return false;
    if (filter === "needed") return item.needed_g > 0;
    if (filter === "sufficient") return item.needed_g === 0;
    return true;
  });

  const neededCount = items.filter(i => i.weekly_quantity > 0 && i.needed_g > 0).length;
  const totalWeeklyG = items.reduce((a, i) => a + (i.weekly_quantity > 0 ? i.weekly_quantity : 0), 0);
  const totalStockG = items.reduce((a, i) => a + (i.weekly_quantity > 0 ? Math.min(i.stock_g, i.weekly_quantity) : 0), 0);
  const coveragePct = totalWeeklyG > 0 ? Math.min((totalStockG / totalWeeklyG) * 100, 100) : 0;
  const scheduledItems = items.filter(i => i.weekly_quantity > 0);

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-foreground max-w-[430px] mx-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-top pt-4 pb-4 border-b border-border/30">
        <Link href="/dashboard">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Shopping List</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Summary cards */}
        {scheduledItems.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <Card className="bg-[#1A1A1A] border-border/40 p-3 text-center">
              <p className="text-lg font-bold text-foreground">{filtered.length}</p>
              <p className="text-[10px] text-muted-foreground">Items in plan</p>
            </Card>
            <Card className={`border-border/40 p-3 text-center ${neededCount > 0 ? "bg-amber-500/10" : "bg-primary/10"}`}>
              <p className={`text-lg font-bold ${neededCount > 0 ? "text-amber-500" : "text-primary"}`}>{neededCount}</p>
              <p className="text-[10px] text-muted-foreground">Need to buy</p>
            </Card>
            <Card className="bg-[#1A1A1A] border-border/40 p-3 text-center">
              <p className="text-lg font-bold text-primary">{Math.round(coveragePct)}%</p>
              <p className="text-[10px] text-muted-foreground">Stocked</p>
            </Card>
          </div>
        )}

        {/* Weekly coverage bar */}
        {scheduledItems.length > 0 && (
          <Card className="bg-[#1A1A1A] border-border/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Weekly Coverage</span>
              </div>
              <span className="text-xs text-muted-foreground">{Math.round(totalStockG)}g / {Math.round(totalWeeklyG)}g</span>
            </div>
            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${coveragePct >= 100 ? "bg-primary" : coveragePct > 50 ? "bg-amber-400" : "bg-red-500"}`}
                style={{ width: `${coveragePct}%` }}
              />
            </div>
            {neededCount > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-amber-500" />
                Stock is automatically updated as you complete meals in your plan
              </p>
            )}
          </Card>
        )}

        {/* Filter tabs */}
        {scheduledItems.length > 0 && (
          <div className="flex gap-2">
            {(["all", "needed", "sufficient"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all border ${
                  filter === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {f === "all" ? `All (${scheduledItems.length})` : f === "needed" ? `Need (${neededCount})` : `Have (${scheduledItems.length - neededCount})`}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <div className="text-center space-y-2">
              <ShoppingCart className="w-8 h-8 mx-auto animate-pulse" />
              <p className="text-sm">Loading your shopping list…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="text-center py-16 text-destructive text-sm">
            Failed to load shopping list. Please try again.
          </div>
        )}

        {/* Empty state: no meals at all */}
        {!isLoading && !isError && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
              <ShoppingCart className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No items yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add meals and foods to your Meal Builder, then schedule them to see your weekly shopping requirements here.
              </p>
            </div>
            <Link href="/nutrition/meals">
              <button className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                Go to Meal Builder
              </button>
            </Link>
          </div>
        )}

        {/* Empty state: meals exist but none scheduled */}
        {!isLoading && !isError && items.length > 0 && scheduledItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
              <ShoppingCart className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No scheduled meals yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Schedule your meals to specific days of the week in the Meal Builder to see your weekly ingredient requirements here.
              </p>
            </div>
            <Link href="/nutrition/meals">
              <button className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                Schedule Meals
              </button>
            </Link>
          </div>
        )}

        {/* Items list */}
        {!isLoading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(item => (
              <ItemCard
                key={`${item.food_id}::${item.food_source}`}
                item={item}
              />
            ))}
          </div>
        )}

        {/* Empty filtered state */}
        {!isLoading && scheduledItems.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No items in this category.
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}
