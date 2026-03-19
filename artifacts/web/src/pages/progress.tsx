import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Loader2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import BottomNav from "@/components/bottom-nav";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

interface ProgressData {
  weightHistory: { date: string; weight_kg: number }[];
  mealCompliance: { date: string; planned: number; completed: number }[];
  workoutCompliance: { date: string; planned: number; completed: number }[];
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateAxis(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  if (day === 1 || day === 8 || day === 15 || day === 22 || day === 29) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return "";
}

const TEAL = "#0D9E75";
const GREY = "#6B7280";
const CHART_BG = "#1A1A1A";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  unit?: string;
}

function CustomTooltip({ active, payload, label, unit = "" }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#222] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1">{label ? formatDateShort(label) : ""}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}{unit}
        </p>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
        <Minus className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function Progress() {
  const { data, isLoading } = useQuery<ProgressData>({
    queryKey: ["progress"],
    queryFn: () => customFetch<ProgressData>(`${BASE}/progress`),
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="mobile-container flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const weightHistory = data?.weightHistory ?? [];
  const mealCompliance = data?.mealCompliance ?? [];
  const workoutCompliance = data?.workoutCompliance ?? [];

  // Filter compliance data to only days that have any planned activity
  const mealChartData = mealCompliance.filter(d => d.planned > 0 || d.completed > 0);
  const workoutChartData = workoutCompliance.filter(d => d.planned > 0 || d.completed > 0);

  // Weight stats
  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight_kg : null;
  const startWeight = weightHistory.length > 0 ? weightHistory[0].weight_kg : null;
  const weightChange = currentWeight !== null && startWeight !== null ? +(currentWeight - startWeight).toFixed(1) : null;

  return (
    <div className="mobile-container overflow-y-auto scrollbar-none pb-24">
      {/* Header */}
      <header className="px-6 py-4 sticky top-0 bg-background/80 backdrop-blur-xl z-10 border-b border-border/50">
        <h1 className="text-xl font-semibold tracking-tight">Progress</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
      </header>

      <main className="px-6 pt-6 space-y-8">

        {/* ── Chart 1: Weight ─────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Weight</p>
              {currentWeight !== null && (
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  Current: {currentWeight}kg
                </p>
              )}
            </div>
            {weightChange !== null && (
              <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                weightChange < 0
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : weightChange > 0
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-white/5 text-muted-foreground border border-white/10"
              }`}>
                {weightChange < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : weightChange > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                {weightChange < 0
                  ? `Lost ${Math.abs(weightChange)}kg`
                  : weightChange > 0
                    ? `Gained ${weightChange}kg`
                    : "No change"} since start
              </div>
            )}
          </div>

          <Card className="p-4 bg-[#1A1A1A] border-none">
            {weightHistory.length < 2 ? (
              <EmptyState message="Update your weight a few times to see your trend here." />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weightHistory} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateAxis}
                    tick={{ fill: "#6B7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#6B7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip content={<CustomTooltip unit="kg" />} />
                  <Line
                    type="monotone"
                    dataKey="weight_kg"
                    name="Weight"
                    stroke={TEAL}
                    strokeWidth={2.5}
                    dot={{ fill: TEAL, r: 3, strokeWidth: 0 }}
                    activeDot={{ fill: TEAL, r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </section>

        {/* ── Chart 2: Meal Compliance ─────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Meal Compliance</p>

          <Card className="p-4 bg-[#1A1A1A] border-none">
            {mealChartData.length === 0 ? (
              <EmptyState message="Schedule meals in your Meal Plan to start tracking compliance." />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={mealChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateAxis}
                    tick={{ fill: "#6B7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#6B7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={25}
                    allowDecimals={false}
                    domain={[0, "auto"]}
                  />
                  <Tooltip content={<CustomTooltip unit=" meals" />} />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    formatter={(value) => (
                      <span style={{ color: value === "Planned" ? GREY : TEAL, fontSize: 11 }}>{value}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="planned"
                    name="Planned"
                    stroke={GREY}
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={false}
                    activeDot={{ fill: GREY, r: 4, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke={TEAL}
                    strokeWidth={2.5}
                    dot={{ fill: TEAL, r: 2.5, strokeWidth: 0 }}
                    activeDot={{ fill: TEAL, r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {mealChartData.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Dashed line = planned &nbsp;·&nbsp; Solid teal = completed. Gap = missed meals.
            </p>
          )}
        </section>

        {/* ── Chart 3: Workout Compliance ──────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Workout Compliance</p>

          <Card className="p-4 bg-[#1A1A1A] border-none">
            {workoutChartData.length === 0 ? (
              <EmptyState message="Schedule workouts in your Workout Plan to start tracking compliance." />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={workoutChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateAxis}
                    tick={{ fill: "#6B7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#6B7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={25}
                    allowDecimals={false}
                    domain={[0, "auto"]}
                  />
                  <Tooltip content={<CustomTooltip unit=" exercises" />} />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    formatter={(value) => (
                      <span style={{ color: value === "Planned" ? GREY : TEAL, fontSize: 11 }}>{value}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="planned"
                    name="Planned"
                    stroke={GREY}
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={false}
                    activeDot={{ fill: GREY, r: 4, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke={TEAL}
                    strokeWidth={2.5}
                    dot={{ fill: TEAL, r: 2.5, strokeWidth: 0 }}
                    activeDot={{ fill: TEAL, r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {workoutChartData.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Dashed line = planned &nbsp;·&nbsp; Solid teal = completed. Gap = missed exercises.
            </p>
          )}
        </section>

      </main>

      <BottomNav />
    </div>
  );
}
