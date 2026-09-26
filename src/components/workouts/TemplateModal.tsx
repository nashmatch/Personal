"use client";

import { useState } from "react";
import { Trash2, Save } from "lucide-react";
import { Modal, Button, Input, Label } from "@/components/ui";
import { ExercisePicker } from "./ExercisePicker";

interface TemplateExercise {
  exerciseId: string;
  name: string;
  targetSets: number;
  targetReps: number;
}

export function TemplateModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [saving, setSaving] = useState(false);

  function addExercise(ex: { id: string; name: string }) {
    setExercises((prev) => [...prev, { exerciseId: ex.id, name: ex.name, targetSets: 3, targetReps: 10 }]);
  }

  function update(idx: number, patch: Partial<TemplateExercise>) {
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function remove(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!name.trim() || exercises.length === 0) return;
    setSaving(true);
    try {
      await fetch("/api/workout-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, exercises }),
      });
      setName("");
      setExercises([]);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New workout template" wide>
      <div className="mb-4">
        <Label>Template name</Label>
        <Input placeholder="e.g. Push Day" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="mb-4">
        <ExercisePicker onPick={addExercise} />
      </div>

      <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
        {exercises.map((e, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-border-hairline p-2.5">
            <span className="flex-1 text-sm font-medium">{e.name}</span>
            <Input
              type="number"
              value={e.targetSets}
              onChange={(ev) => update(i, { targetSets: Number(ev.target.value) })}
              className="w-16"
            />
            <span className="text-xs text-muted">sets ×</span>
            <Input
              type="number"
              value={e.targetReps}
              onChange={(ev) => update(i, { targetReps: Number(ev.target.value) })}
              className="w-16"
            />
            <span className="text-xs text-muted">reps</span>
            <button onClick={() => remove(i)} className="text-muted hover:text-accent-red">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <Button onClick={save} disabled={saving || exercises.length === 0 || !name.trim()} className="mt-4 w-full">
        <Save size={15} /> {saving ? "Saving..." : "Save template"}
      </Button>
    </Modal>
  );
}
