"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus, Dumbbell, Trash2, Play, ChevronDown, ChevronUp } from "lucide-react";
import { Card, SectionHeading, Button, Select } from "@/components/ui";
import { BodyMuscleMap } from "@/components/BodyMuscleMap";
import { LogWorkoutModal } from "@/components/workouts/LogWorkoutModal";
import { TemplateModal } from "@/components/workouts/TemplateModal";

interface Template {
  id: string;
  name: string;
  exercises: { exerciseId: string; targetSets: number; targetReps: number; exercise: { name: string } }[];
}

interface WorkoutLog {
  id: string;
  name: string;
  date: string;
  sets: { id: string; reps: number; weightKg: number; isWarmup: boolean; exercise: { name: string } }[];
}

export default function WorkoutsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [muscleData, setMuscleData] = useState<Record<string, number>>({});
  const [days, setDays] = useState(7);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<Template | null>(null);
  const [logSessionKey, setLogSessionKey] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [t, l, m] = await Promise.all([
      fetch("/api/workout-templates").then((r) => r.json()),
      fetch("/api/workout-logs").then((r) => r.json()),
      fetch(`/api/muscle-volume?days=${days}`).then((r) => r.json()),
    ]);
    setTemplates(t.templates ?? []);
    setLogs(l.logs ?? []);
    const dataMap: Record<string, number> = {};
    for (const row of m.muscles ?? []) dataMap[row.muscle] = row.ratio;
    setMuscleData(dataMap);
  }, [days]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function deleteTemplate(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/workout-templates?id=${id}`, { method: "DELETE" });
  }

  async function deleteLog(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/workout-logs?id=${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <SectionHeading
        title="Workouts"
        subtitle="Build routines, log training sessions, and see which muscles you're hitting."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setTemplateModalOpen(true)}>
              <Plus size={15} /> Template
            </Button>
            <Button
              onClick={() => {
                setPrefill(null);
                setLogSessionKey((k) => k + 1);
                setLogModalOpen(true);
              }}
            >
              <Dumbbell size={15} /> Log workout
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Muscles worked</h3>
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-32">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </Select>
        </div>
        <BodyMuscleMap data={muscleData} />
      </Card>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-secondary">Templates</h3>
        {templates.length === 0 ? (
          <p className="text-sm text-muted">No templates yet — create one to speed up logging.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Card key={t.id}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{t.name}</p>
                  <button onClick={() => deleteTemplate(t.id)} className="text-muted hover:text-accent-red">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="mb-3 text-xs text-muted">{t.exercises.length} exercises</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setPrefill(t);
                    setLogSessionKey((k) => k + 1);
                    setLogModalOpen(true);
                  }}
                >
                  <Play size={13} /> Start
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-secondary">History</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-muted">No workouts logged yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => {
              const isOpen = expanded === l.id;
              const workingSets = l.sets.filter((s) => !s.isWarmup);
              return (
                <Card key={l.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : l.id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <p className="font-medium">{l.name}</p>
                      <p className="text-xs text-muted">
                        {format(new Date(l.date), "EEE, MMM d")} · {workingSets.length} working sets
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLog(l.id);
                        }}
                        className="text-muted hover:text-accent-red"
                      >
                        <Trash2 size={14} />
                      </button>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-3 space-y-1 border-t border-border-hairline pt-3">
                      {Object.entries(groupByExercise(l.sets)).map(([name, sets]) => (
                        <div key={name} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{name}</span>
                          <span className="text-xs text-muted">
                            {sets.map((s) => `${s.reps}×${s.weightKg}kg${s.isWarmup ? " (w)" : ""}`).join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <LogWorkoutModal
        key={logSessionKey}
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        onSaved={refresh}
        initialName={prefill?.name}
        initialExercises={prefill?.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          name: e.exercise.name,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
        }))}
      />
      <TemplateModal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} onSaved={refresh} />
    </div>
  );
}

function groupByExercise(sets: WorkoutLog["sets"]) {
  const map: Record<string, WorkoutLog["sets"]> = {};
  for (const s of sets) {
    (map[s.exercise.name] ??= []).push(s);
  }
  return map;
}
