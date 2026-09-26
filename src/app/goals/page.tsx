"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2, Target } from "lucide-react";
import { Card, SectionHeading, Button, Input, Select, Label, Badge, Modal } from "@/components/ui";
import { ExercisePicker } from "@/components/workouts/ExercisePicker";

interface Goal {
  id: string;
  kind: string;
  name: string;
  active: boolean;
  targetCalories?: number | null;
  targetProtein?: number | null;
  targetCarbs?: number | null;
  targetFat?: number | null;
  targetWeightKg?: number | null;
  startWeightKg?: number | null;
  targetDate?: string | null;
  exercise?: { name: string } | null;
  targetWeightForLift?: number | null;
  targetReps?: number | null;
  targetPerWeek?: number | null;
  createdAt: string;
}

const KIND_LABELS: Record<string, string> = {
  NUTRITION: "Nutrition",
  WEIGHT: "Body Weight",
  STRENGTH: "Strength",
  HABIT: "Habit",
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [kind, setKind] = useState("NUTRITION");
  const [form, setForm] = useState<Record<string, string>>({});
  const [pickedExercise, setPickedExercise] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0);

  async function refresh() {
    const [g, metrics, logs] = await Promise.all([
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/body-metrics?take=1").then((r) => r.json()),
      fetch("/api/workout-logs?take=30").then((r) => r.json()),
    ]);
    setGoals(g.goals ?? []);
    setLatestWeight(metrics.metrics?.[metrics.metrics.length - 1]?.weightKg ?? null);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    setWeeklyWorkouts(
      (logs.logs ?? []).filter((l: { date: string }) => new Date(l.date).getTime() > weekAgo).length,
    );
  }

  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { kind, name: form.name || `${KIND_LABELS[kind]} Goal` };
      if (kind === "NUTRITION") {
        Object.assign(body, {
          targetCalories: Number(form.targetCalories),
          targetProtein: Number(form.targetProtein),
          targetCarbs: Number(form.targetCarbs),
          targetFat: Number(form.targetFat),
        });
      } else if (kind === "WEIGHT") {
        Object.assign(body, {
          targetWeightKg: Number(form.targetWeightKg),
          startWeightKg: form.startWeightKg ? Number(form.startWeightKg) : latestWeight,
          targetDate: form.targetDate || undefined,
        });
      } else if (kind === "STRENGTH") {
        Object.assign(body, {
          exerciseId: pickedExercise?.id,
          targetWeightForLift: Number(form.targetWeightForLift),
          targetReps: Number(form.targetReps || 1),
        });
        body.name = form.name || `${pickedExercise?.name ?? "Lift"} Goal`;
      } else if (kind === "HABIT") {
        Object.assign(body, { targetPerWeek: Number(form.targetPerWeek) });
      }

      await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setModalOpen(false);
      setForm({});
      setPickedExercise(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <SectionHeading
        title="Goals"
        subtitle="Set nutrition, weight, strength, and habit targets — track progress automatically."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={15} /> New goal
          </Button>
        }
      />

      {goals.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <Target className="text-muted" size={28} />
          <p className="text-sm text-muted">No goals yet. Set one to start tracking progress.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((g) => (
            <Card key={g.id}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge tone="blue">{KIND_LABELS[g.kind]}</Badge>
                  {g.active && g.kind === "NUTRITION" && <Badge tone="green">Active</Badge>}
                </div>
                <button onClick={() => remove(g.id)} className="text-muted hover:text-accent-red">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="mb-2 font-medium">{g.name}</p>
              {g.kind === "NUTRITION" && (
                <p className="text-sm text-secondary">
                  {g.targetCalories} kcal · P{g.targetProtein}g C{g.targetCarbs}g F{g.targetFat}g
                </p>
              )}
              {g.kind === "WEIGHT" && (
                <WeightProgress start={g.startWeightKg} target={g.targetWeightKg} current={latestWeight} />
              )}
              {g.kind === "STRENGTH" && (
                <p className="text-sm text-secondary">
                  {g.exercise?.name}: {g.targetWeightForLift}kg × {g.targetReps} reps
                </p>
              )}
              {g.kind === "HABIT" && (
                <p className="text-sm text-secondary">
                  {weeklyWorkouts} / {g.targetPerWeek} workouts this week
                </p>
              )}
              {g.targetDate && (
                <p className="mt-1 text-xs text-muted">By {format(new Date(g.targetDate), "MMM d, yyyy")}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New goal">
        <div className="space-y-3">
          <div>
            <Label>Goal type</Label>
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="NUTRITION">Nutrition targets</option>
              <option value="WEIGHT">Body weight</option>
              <option value="STRENGTH">Strength (specific lift)</option>
              <option value="HABIT">Habit (workouts / week)</option>
            </Select>
          </div>

          <div>
            <Label>Name (optional)</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          {kind === "NUTRITION" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Calories" value={form.targetCalories} onChange={(v) => setForm({ ...form, targetCalories: v })} />
              <Field label="Protein (g)" value={form.targetProtein} onChange={(v) => setForm({ ...form, targetProtein: v })} />
              <Field label="Carbs (g)" value={form.targetCarbs} onChange={(v) => setForm({ ...form, targetCarbs: v })} />
              <Field label="Fat (g)" value={form.targetFat} onChange={(v) => setForm({ ...form, targetFat: v })} />
            </div>
          )}

          {kind === "WEIGHT" && (
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Starting weight (kg)"
                value={form.startWeightKg ?? latestWeight ?? ""}
                onChange={(v) => setForm({ ...form, startWeightKg: v })}
              />
              <Field label="Target weight (kg)" value={form.targetWeightKg} onChange={(v) => setForm({ ...form, targetWeightKg: v })} />
              <div className="col-span-2">
                <Label>Target date (optional)</Label>
                <Input type="date" value={form.targetDate ?? ""} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
              </div>
            </div>
          )}

          {kind === "STRENGTH" && (
            <div className="space-y-3">
              <div>
                <Label>Exercise</Label>
                {pickedExercise ? (
                  <div className="flex items-center justify-between rounded-lg border border-border-hairline px-3 py-2 text-sm">
                    {pickedExercise.name}
                    <button onClick={() => setPickedExercise(null)} className="text-xs text-accent-blue">
                      Change
                    </button>
                  </div>
                ) : (
                  <ExercisePicker onPick={(ex) => setPickedExercise(ex)} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Target weight (kg)" value={form.targetWeightForLift} onChange={(v) => setForm({ ...form, targetWeightForLift: v })} />
                <Field label="Target reps" value={form.targetReps} onChange={(v) => setForm({ ...form, targetReps: v })} />
              </div>
            </div>
          )}

          {kind === "HABIT" && (
            <Field label="Workouts per week" value={form.targetPerWeek} onChange={(v) => setForm({ ...form, targetPerWeek: v })} />
          )}

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save goal"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function WeightProgress({
  start,
  target,
  current,
}: {
  start?: number | null;
  target?: number | null;
  current?: number | null;
}) {
  if (!start || !target) return null;
  const totalDelta = target - start;
  const currentVal = current ?? start;
  const progressDelta = currentVal - start;
  const ratio = totalDelta !== 0 ? Math.min(Math.max(progressDelta / totalDelta, 0), 1) : 0;
  return (
    <div>
      <p className="mb-1 text-sm text-secondary">
        {currentVal.toFixed(1)}kg → {target}kg
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-sunken">
        <div className="h-full rounded-full bg-accent-blue transition-all" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
