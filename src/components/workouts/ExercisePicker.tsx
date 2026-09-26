"use client";

import { useEffect, useState } from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui";

interface ExerciseOption {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  primaryMuscles: string[];
}

export function ExercisePicker({ onPick }: { onPick: (ex: ExerciseOption) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ExerciseOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/exercises?q=${encodeURIComponent(q)}&take=15`);
      const data = await res.json();
      setResults(data.exercises ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Search exercises to add..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          className="pl-9"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border-hairline bg-card shadow-lg scrollbar-thin">
          {results.map((ex) => (
            <button
              key={ex.id}
              onClick={() => {
                onPick(ex);
                setQ("");
                setResults([]);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-card-hover"
            >
              <div>
                <p className="font-medium">{ex.name}</p>
                <p className="text-xs text-muted">{ex.primaryMuscles.join(", ")}</p>
              </div>
              <Plus size={14} className="text-muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
