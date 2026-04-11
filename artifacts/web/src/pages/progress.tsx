import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Loader2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import BottomNav from "@/components/bottom-nav";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useCoachClient, useClientUrl } from "@/context/coach-client-context";
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
  dailyDeficit: { date: string; maintenance_calories: number; daily_deficit: number }[];
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

const TEAL = "#2DD4BF";
const GREY = "#6B7280";
const CHART_BG = "#0F1F3D";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  unit?: string;
}

function CustomTooltip({ active, payload, label, unit = "" }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0F1F3D] border border-[#1B3260] rounded-xl px-3 py-2 text-xs shadow-xl">
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
  const { t } = useLanguage();
  const { activeClient } = useCoachClient();
  const buildUrl = useClientUrl();
  const { data, isLoading } = useQuery<ProgressData>({
    queryKey: ["progress", activeClient?.id],
    queryFn: () => customFetch<ProgressData>(buildUrl(`${BASE}/progress`)),
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
  const dailyDeficit = data?.dailyDeficit ?? [];

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
      <header className="px-6 py-4 sticky top-0 bg-background/80 backdrop-blur-xl z-10 border-b border-border/50 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("progress.title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t("progress.subtitle")}</p>
        </div>
        <LanguageSwitcher variant="icon-only" />
      </header>

      <main className="px-6 pt-6 space-y-8">

        {/* ── Chart 1: Weight ─────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("progress.weight")}</p>
              {currentWeight !== null && (
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {t("progress.current")} {currentWeight}{t("common.kg")}
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
                  ? `${t("progress.lost")} ${Math.abs(weightChange)}${t("common.kg")}`
                  : weightChange > 0
                    ? `${t("progress.gained")} ${weightChange}${t("common.kg")}`
                    : t("progress.noChange")} {t("progress.sinceStart")}
              </div>
            )}
          </div>

          <Card className="p-4 bg-[#0F1F3D] border-none">
            {weightHistory.length < 2 ? (
              <EmptyState message={t("progress.noWeightData")} />
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
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("progress.mealCompliance")}</p>

          <Card className="p-4 bg-[#0F1F3D] border-none">
            {mealChartData.length === 0 ? (
              <EmptyState message={t("progress.noMealData")} />
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
              {t("progress.dashTip")} {t("progress.meals")}.
            </p>
          )}
        </section>

        {/* ── Chart 3: Workout Compliance ──────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("progress.workoutCompliance")}</p>

          <Card className="p-4 bg-[#0F1F3D] border-none">
            {workoutChartData.length === 0 ? (
              <EmptyState message={t("progress.noWorkoutData")} />
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
              {t("progress.dashTip")} {t("progress.exercises")}.
            </p>
          )}
        </section>

        {/* ── Chart 4: Daily Deficit vs Maintenance Calories ────────────────────── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("progress.dailyDeficit")}</p>

          <Card className="p-4 bg-[#0F1F3D] border-none">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyDeficit} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
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
                />
                <Tooltip content={<CustomTooltip unit=" kcal" />} />
                <Legend
                  verticalAlign="top"
                  height={28}
                  formatter={(value) => (
                    <span style={{ color: value === "Maintenance" ? GREY : TEAL, fontSize: 11 }}>{value}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="maintenance_calories"
                  name="Maintenance"
                  stroke={GREY}
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={false}
                  activeDot={{ fill: GREY, r: 4, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="daily_deficit"
                  name="Deficit"
                  stroke={TEAL}
                  strokeWidth={2.5}
                  dot={{ fill: TEAL, r: 2.5, strokeWidth: 0 }}
                  activeDot={{ fill: TEAL, r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            {t("progress.maintenanceTip")}
          </p>
        </section>

      </main>

      <BottomNav />
    </div>
  );
}
