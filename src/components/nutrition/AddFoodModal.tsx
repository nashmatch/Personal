"use client";

import { useEffect, useState } from "react";
import { Modal, Button, Input, Badge } from "@/components/ui";
import { Search, Plus } from "lucide-react";

interface FoodResult {
  id?: string;
  fdcId?: number;
  name: string;
  brand?: string;
  servingQty: number;
  servingUnit: string;
  gramsPerServing: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
}

export function AddFoodModal({
  open,
  onClose,
  date,
  mealType,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  mealType: string;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [local, setLocal] = useState<FoodResult[]>([]);
  const [remote, setRemote] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [servings, setServings] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLocal([]);
      setRemote([]);
      setSelected(null);
      setServings(1);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setLocal([]);
      setRemote([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setLocal(data.local ?? []);
      setRemote(data.remote ?? []);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  async function handleAdd() {
    if (!selected) return;
    setSaving(true);
    try {
      let foodId = selected.id;
      if (!foodId) {
        const res = await fetch("/api/foods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...selected, source: "USDA" }),
        });
        const data = await res.json();
        foodId = data.food.id;
      }
      await fetch("/api/meal-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mealType, foodId, servings }),
      });
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Add food — ${titleCase(mealType)}`} wide>
      {!selected ? (
        <div>
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              autoFocus
              placeholder="Search foods (e.g. chicken breast, oats, banana)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-[45vh] space-y-1 overflow-y-auto scrollbar-thin">
            {loading && <p className="py-4 text-center text-sm text-muted">Searching...</p>}
            {!loading && query && local.length === 0 && remote.length === 0 && (
              <p className="py-4 text-center text-sm text-muted">No results. Try a different term.</p>
            )}
            {local.length > 0 && (
              <>
                <p className="px-1 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Your library
                </p>
                {local.map((f) => (
                  <FoodRow key={f.id} food={f} onClick={() => setSelected(f)} />
                ))}
              </>
            )}
            {remote.length > 0 && (
              <>
                <p className="px-1 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted">
                  USDA FoodData Central
                </p>
                {remote.map((f) => (
                  <FoodRow key={f.fdcId} food={f} onClick={() => setSelected(f)} />
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={() => setSelected(null)}
            className="mb-3 text-xs font-medium text-accent-blue hover:underline"
          >
            ← Back to results
          </button>
          <div className="mb-4 rounded-lg border border-border-hairline p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selected.name}</p>
                {selected.brand && <p className="text-xs text-muted">{selected.brand}</p>}
              </div>
              <Badge tone="blue">{Math.round(selected.calories * servings)} kcal</Badge>
            </div>
            <div className="mt-2 flex gap-3 text-xs text-secondary">
              <span>P {Math.round(selected.proteinG * servings)}g</span>
              <span>C {Math.round(selected.carbsG * servings)}g</span>
              <span>F {Math.round(selected.fatG * servings)}g</span>
            </div>
          </div>

          <label className="mb-1.5 block text-xs font-medium text-secondary">
            Servings ({selected.servingQty} {selected.servingUnit} each)
          </label>
          <Input
            type="number"
            min={0.25}
            step={0.25}
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
            className="mb-4"
          />

          <Button onClick={handleAdd} disabled={saving} className="w-full">
            <Plus size={15} /> {saving ? "Adding..." : "Add to log"}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function FoodRow({ food, onClick }: { food: FoodResult; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-card-hover"
    >
      <div>
        <p className="font-medium">{food.name}</p>
        <p className="text-xs text-muted">
          {food.brand ? `${food.brand} · ` : ""}
          {food.servingQty} {food.servingUnit}
        </p>
      </div>
      <div className="text-right text-xs text-secondary">
        <p className="font-medium">{Math.round(food.calories)} kcal</p>
        <p className="text-muted">
          P{Math.round(food.proteinG)} C{Math.round(food.carbsG)} F{Math.round(food.fatG)}
        </p>
      </div>
    </button>
  );
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
