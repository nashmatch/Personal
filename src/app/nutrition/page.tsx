"use client";

import { useCallback, useEffect, useState } from "react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Card, SectionHeading, Button, Badge } from "@/components/ui";
import { CalorieRing, MacroBar } from "@/components/CalorieRing";
import { AddFoodModal } from "@/components/nutrition/AddFoodModal";

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];
const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snacks",
};

interface MealLogEntry {
  id: string;
  mealType: string;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  food?: { name: string } | null;
  recipe?: { name: string } | null;
}

export default function NutritionPage() {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [logs, setLogs] = useState<MealLogEntry[]>([]);
  const [goal, setGoal] = useState<{ calories: number; proteinG: number; carbsG: number; fatG: number } | null>(
    null,
  );
  const [modalMeal, setModalMeal] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [logsRes, summaryRes] = await Promise.all([
      fetch(`/api/meal-logs?date=${date}`).then((r) => r.json()),
      fetch(`/api/summary?date=${date}`).then((r) => r.json()),
    ]);
    setLogs(logsRes.logs ?? []);
    setGoal(summaryRes.goal);
  }, [date]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function deleteLog(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/meal-logs?id=${id}`, { method: "DELETE" });
    refresh();
  }

  const totals = logs.reduce(
    (acc, l) => {
      acc.calories += l.calories;
      acc.proteinG += l.proteinG;
      acc.carbsG += l.carbsG;
      acc.fatG += l.fatG;
      return acc;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const g = goal ?? { calories: 2200, proteinG: 160, carbsG: 220, fatG: 70 };
  const isToday = date === format(new Date(), "yyyy-MM-dd");

  return (
    <div>
      <SectionHeading
        title="Nutrition"
        subtitle="Log meals and track macros against your daily targets."
      />

      <div className="mb-6 flex items-center justify-center gap-3">
        <button
          onClick={() => setDate(format(subDays(parseISO(date), 1), "yyyy-MM-dd"))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border-hairline text-secondary hover:bg-card-hover"
        >
          <ChevronLeft size={15} />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium">{format(parseISO(date), "EEEE, MMM d")}</p>
          {isToday && <p className="text-xs text-muted">Today</p>}
        </div>
        <button
          onClick={() => setDate(format(addDays(parseISO(date), 1), "yyyy-MM-dd"))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border-hairline text-secondary hover:bg-card-hover"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-[auto_1fr]">
        <Card className="flex items-center justify-center">
          <CalorieRing consumed={totals.calories} target={g.calories} />
        </Card>
        <Card className="flex flex-col justify-center gap-4">
          <MacroBar label="Protein" color="var(--accent-blue)" consumed={totals.proteinG} target={g.proteinG} />
          <MacroBar label="Carbs" color="var(--accent-orange)" consumed={totals.carbsG} target={g.carbsG} />
          <MacroBar label="Fat" color="var(--accent-aqua)" consumed={totals.fatG} target={g.fatG} />
        </Card>
      </div>

      <div className="space-y-4">
        {MEAL_TYPES.map((mealType) => {
          const entries = logs.filter((l) => l.mealType === mealType);
          const mealCals = entries.reduce((s, e) => s + e.calories, 0);
          return (
            <Card key={mealType}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">{MEAL_LABELS[mealType]}</h3>
                <div className="flex items-center gap-3">
                  {entries.length > 0 && (
                    <span className="text-xs text-muted">{Math.round(mealCals)} kcal</span>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setModalMeal(mealType)}>
                    <Plus size={14} /> Add
                  </Button>
                </div>
              </div>
              {entries.length === 0 ? (
                <p className="text-sm text-muted">No items logged yet.</p>
              ) : (
                <ul className="divide-y divide-border-hairline">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium">{e.food?.name ?? e.recipe?.name ?? "Item"}</p>
                        <p className="text-xs text-muted">
                          {e.servings} serving{e.servings !== 1 ? "s" : ""} · P{Math.round(e.proteinG)} C
                          {Math.round(e.carbsG)} F{Math.round(e.fatG)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge>{Math.round(e.calories)} kcal</Badge>
                        <button
                          onClick={() => deleteLog(e.id)}
                          className="text-muted hover:text-accent-red"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {modalMeal && (
        <AddFoodModal
          open={!!modalMeal}
          onClose={() => setModalMeal(null)}
          date={date}
          mealType={modalMeal}
          onAdded={refresh}
        />
      )}
    </div>
  );
}
