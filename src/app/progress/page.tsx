"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Plus } from "lucide-react";
import { Card, SectionHeading, Button, Input, Select, Label } from "@/components/ui";

interface NutritionPoint {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
interface WorkoutPoint {
  date: string;
  volumeKg: number;
}
interface WeightPoint {
  date: string;
  weightKg: number | null;
}

export default function ProgressPage() {
  const [range, setRange] = useState(30);
  const [nutrition, setNutrition] = useState<NutritionPoint[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutPoint[]>([]);
  const [weights, setWeights] = useState<WeightPoint[]>([]);
  const [goalCalories, setGoalCalories] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [bfInput, setBfInput] = useState("");

  async function refresh() {
    const [n, w, m, s] = await Promise.all([
      fetch(`/api/nutrition-history?days=${range}`).then((r) => r.json()),
      fetch(`/api/workout-history?days=${range}`).then((r) => r.json()),
      fetch(`/api/body-metrics?take=200`).then((r) => r.json()),
      fetch(`/api/summary`).then((r) => r.json()),
    ]);
    setNutrition(n.series ?? []);
    setWorkouts(w.series ?? []);
    setGoalCalories(s.goal?.calories ?? null);

    const metricByDay = new Map<string, number>();
    for (const met of m.metrics ?? []) {
      if (met.weightKg != null) metricByDay.set(format(new Date(met.date), "yyyy-MM-dd"), met.weightKg);
    }
    const weightSeries = nutritionDays(range).map((date) => ({ date, weightKg: metricByDay.get(date) ?? null }));
    setWeights(weightSeries);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  async function logWeight() {
    if (!weightInput) return;
    await fetch("/api/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: format(new Date(), "yyyy-MM-dd"),
        weightKg: Number(weightInput),
        bodyFatPct: bfInput ? Number(bfInput) : undefined,
      }),
    });
    setWeightInput("");
    setBfInput("");
    setLogOpen(false);
    refresh();
  }

  return (
    <div>
      <SectionHeading
        title="Progress"
        subtitle="Trends across nutrition, training volume, and body weight."
        action={
          <div className="flex items-center gap-2">
            <Select value={range} onChange={(e) => setRange(Number(e.target.value))} className="w-32">
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </Select>
            <Button size="sm" onClick={() => setLogOpen((v) => !v)}>
              <Plus size={14} /> Log weight
            </Button>
          </div>
        }
      />

      {logOpen && (
        <Card className="mb-6">
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <div>
              <Label>Weight (kg)</Label>
              <Input type="number" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} />
            </div>
            <div>
              <Label>Body fat % (optional)</Label>
              <Input type="number" value={bfInput} onChange={(e) => setBfInput(e.target.value)} />
            </div>
            <Button onClick={logWeight}>Save</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-medium">Body weight (kg)</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weights} margin={{ left: 0, right: 10 }}>
                <CartesianGrid stroke="var(--border-hairline)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(parseISO(d), "MMM d")}
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={{ stroke: "var(--border-hairline)" }}
                  tickLine={false}
                  minTickGap={30}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip suffix="kg" />} />
                <Line
                  type="monotone"
                  dataKey="weightKg"
                  stroke="var(--accent-blue)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--accent-blue)" }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-medium">Calories vs. goal</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={nutrition} margin={{ left: 0, right: 10 }}>
                <CartesianGrid stroke="var(--border-hairline)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(parseISO(d), "MMM d")}
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={{ stroke: "var(--border-hairline)" }}
                  tickLine={false}
                  minTickGap={30}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTooltip suffix=" kcal" />} />
                {goalCalories && (
                  <ReferenceLine
                    y={goalCalories}
                    stroke="var(--text-muted)"
                    strokeDasharray="4 4"
                    label={{ value: "Goal", fontSize: 11, fill: "var(--text-muted)", position: "insideTopRight" }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="calories"
                  stroke="var(--accent-blue)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="mb-4 font-medium">Training volume (kg lifted per day)</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={workouts} margin={{ left: 0, right: 10 }}>
                <CartesianGrid stroke="var(--border-hairline)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(parseISO(d), "MMM d")}
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={{ stroke: "var(--border-hairline)" }}
                  tickLine={false}
                  minTickGap={30}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTooltip suffix=" kg" />} />
                <Line
                  type="monotone"
                  dataKey="volumeKg"
                  stroke="var(--accent-aqua)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--accent-aqua)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number | null }[];
  label?: string;
  suffix: string;
}

function ChartTooltip({ active, payload, label, suffix }: ChartTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-border-hairline bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-primary">{format(parseISO(label), "MMM d, yyyy")}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-secondary">
          {p.value != null ? `${p.value}${suffix}` : "—"}
        </p>
      ))}
    </div>
  );
}

function nutritionDays(days: number) {
  const arr: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    arr.push(format(new Date(Date.now() - i * 86400000), "yyyy-MM-dd"));
  }
  return arr;
}
