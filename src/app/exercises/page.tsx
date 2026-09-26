"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Card, SectionHeading, Input, Select, Badge, Modal } from "@/components/ui";
import { MUSCLE_GROUPS } from "@/lib/muscles";

interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  level: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string;
}

export default function ExercisesPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [equipment, setEquipment] = useState("");
  const [muscle, setMuscle] = useState("");
  const [meta, setMeta] = useState<{ categories: string[]; equipment: string[] }>({
    categories: [],
    equipment: [],
  });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exercises/meta")
      .then((r) => r.json())
      .then((d) => setMeta({ categories: d.categories, equipment: d.equipment }));
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (equipment) params.set("equipment", equipment);
      if (muscle) params.set("muscle", muscle);
      fetch(`/api/exercises?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setExercises(d.exercises ?? []);
          setLoading(false);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [q, category, equipment, muscle]);

  return (
    <div>
      <SectionHeading
        title="Exercise Library"
        subtitle="876 exercises with muscles worked, equipment, and step-by-step form."
      />

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-3 lg:col-span-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input placeholder="Search exercises..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {meta.categories.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </Select>
          <Select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            <option value="">All equipment</option>
            {meta.equipment.map((e) => (
              <option key={e} value={e}>
                {titleCase(e)}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setMuscle("")}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              muscle === "" ? "border-accent-blue bg-accent-blue/10 text-accent-blue" : "border-border-hairline text-secondary hover:bg-card-hover"
            }`}
          >
            All muscles
          </button>
          {MUSCLE_GROUPS.map((m) => (
            <button
              key={m}
              onClick={() => setMuscle(m === muscle ? "" : m)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                muscle === m ? "border-accent-blue bg-accent-blue/10 text-accent-blue" : "border-border-hairline text-secondary hover:bg-card-hover"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : exercises.length === 0 ? (
        <p className="text-sm text-muted">No exercises match those filters.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((ex) => (
            <button key={ex.id} onClick={() => setSelected(ex)} className="text-left">
              <Card className="h-full transition hover:bg-card-hover">
                <p className="font-medium">{ex.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {ex.primaryMuscles.map((m) => (
                    <Badge key={m} tone="blue">
                      {m}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">
                  {titleCase(ex.category)} · {ex.equipment ? titleCase(ex.equipment) : "No equipment"} ·{" "}
                  {titleCase(ex.level)}
                </p>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ""} wide>
        {selected && (
          <div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {selected.primaryMuscles.map((m) => (
                <Badge key={m} tone="blue">
                  {m}
                </Badge>
              ))}
              {selected.secondaryMuscles.map((m) => (
                <Badge key={m}>{m}</Badge>
              ))}
            </div>
            <p className="mb-3 text-xs text-muted">
              {titleCase(selected.category)} · {selected.equipment ? titleCase(selected.equipment) : "No equipment"} ·{" "}
              {titleCase(selected.level)}
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-secondary">
              {selected.instructions.split("\n").map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </Modal>
    </div>
  );
}

function titleCase(s: string) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
