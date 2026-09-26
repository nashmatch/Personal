"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2, Save } from "lucide-react";
import { Modal, Button, Input, Label } from "@/components/ui";
import { ExercisePicker } from "./ExercisePicker";

interface SetRow {
  reps: number;
  weightKg: number;
  rpe?: number;
  isWarmup: boolean;
}

interface ExerciseBlock {
  exerciseId: string;
  name: string;
  sets: SetRow[];
}

export function LogWorkoutModal({
  open,
  onClose,
  onSaved,
  initialName = "Workout",
  initialExercises,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialName?: string;
  initialExercises?: { exerciseId: string; name: string; targetSets: number; targetReps: number }[];
}) {
  const [name, setName] = useState(initialName);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [blocks, setBlocks] = useState<ExerciseBlock[]>(
    initialExercises?.map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      sets: Array.from({ length: e.targetSets }, () => ({ reps: e.targetReps, weightKg: 0, isWarmup: false })),
    })) ?? [],
  );
  const [saving, setSaving] = useState(false);

  function addExercise(ex: { id: string; name: string }) {
    setBlocks((prev) => [
      ...prev,
      { exerciseId: ex.id, name: ex.name, sets: [{ reps: 10, weightKg: 0, isWarmup: false }] },
    ]);
  }

  function addSet(blockIdx: number) {
    setBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== blockIdx) return b;
        const last = b.sets[b.sets.length - 1];
        return { ...b, sets: [...b.sets, last ? { ...last } : { reps: 10, weightKg: 0, isWarmup: false }] };
      }),
    );
  }

  function updateSet(blockIdx: number, setIdx: number, patch: Partial<SetRow>) {
    setBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== blockIdx) return b;
        return { ...b, sets: b.sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) };
      }),
    );
  }

  function removeSet(blockIdx: number, setIdx: number) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === blockIdx ? { ...b, sets: b.sets.filter((_, j) => j !== setIdx) } : b)),
    );
  }

  function removeExercise(blockIdx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== blockIdx));
  }

  async function save() {
    setSaving(true);
    try {
      const sets = blocks.flatMap((b) =>
        b.sets.map((s, idx) => ({
          exerciseId: b.exerciseId,
          setNumber: idx + 1,
          reps: s.reps,
          weightKg: s.weightKg,
          rpe: s.rpe,
          isWarmup: s.isWarmup,
        })),
      );
      await fetch("/api/workout-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date, sets }),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log workout" wide>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <Label>Workout name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="mb-4">
        <ExercisePicker onPick={(ex) => addExercise(ex)} />
      </div>

      <div className="max-h-[45vh] space-y-4 overflow-y-auto pr-1 scrollbar-thin">
        {blocks.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">Search above to add exercises to this workout.</p>
        )}
        {blocks.map((b, bi) => (
          <div key={bi} className="rounded-lg border border-border-hairline p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{b.name}</p>
              <button onClick={() => removeExercise(bi)} className="text-muted hover:text-accent-red">
                <Trash2 size={14} />
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="grid grid-cols-[24px_1fr_1fr_1fr_28px] gap-2 text-xs text-muted">
                <span>#</span>
                <span>Reps</span>
                <span>Weight (kg)</span>
                <span>RPE</span>
                <span />
              </div>
              {b.sets.map((s, si) => (
                <div key={si} className="grid grid-cols-[24px_1fr_1fr_1fr_28px] items-center gap-2">
                  <span className="text-xs text-muted">{si + 1}</span>
                  <Input
                    type="number"
                    value={s.reps}
                    onChange={(e) => updateSet(bi, si, { reps: Number(e.target.value) })}
                  />
                  <Input
                    type="number"
                    step={0.5}
                    value={s.weightKg}
                    onChange={(e) => updateSet(bi, si, { weightKg: Number(e.target.value) })}
                  />
                  <Input
                    type="number"
                    step={0.5}
                    placeholder="—"
                    value={s.rpe ?? ""}
                    onChange={(e) => updateSet(bi, si, { rpe: e.target.value ? Number(e.target.value) : undefined })}
                  />
                  <button onClick={() => removeSet(bi, si)} className="text-muted hover:text-accent-red">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => addSet(bi)}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-accent-blue hover:underline"
            >
              <Plus size={12} /> Add set
            </button>
          </div>
        ))}
      </div>

      <Button onClick={save} disabled={saving || blocks.length === 0} className="mt-4 w-full">
        <Save size={15} /> {saving ? "Saving..." : "Save workout"}
      </Button>
    </Modal>
  );
}
