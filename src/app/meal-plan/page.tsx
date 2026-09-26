"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Sparkles, Clock, Plus, Save, Trash2 } from "lucide-react";
import { Card, SectionHeading, Button, Input, Select, Label, Badge } from "@/components/ui";

const CUISINES = ["any", "Italian", "Mexican", "Asian", "American", "Mediterranean", "Indian"];
const TAGS = ["vegetarian", "vegan", "high-protein", "low-carb", "quick", "high-fiber"];
const DAY_ORDER = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

interface PlannedMeal {
  day: number;
  mealType: string;
  recipeId: string;
  servings: number;
  recipe: { id: string; name: string; cuisine: string; totalMinutes: number; imageEmoji: string; tags: string[] };
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface SavedPlan {
  id: string;
  name: string;
  createdAt: string;
  entries: { day: number; mealType: string; servings: number; recipe: PlannedMeal["recipe"] }[];
}

export default function MealPlanPage() {
  const [targetCalories, setTargetCalories] = useState(2200);
  const [targetProtein, setTargetProtein] = useState(160);
  const [targetCarbs, setTargetCarbs] = useState(220);
  const [targetFat, setTargetFat] = useState(70);
  const [days, setDays] = useState(3);
  const [mealsPerDay, setMealsPerDay] = useState<3 | 4>(3);
  const [cuisine, setCuisine] = useState("any");
  const [maxMinutes, setMaxMinutes] = useState("any");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState("");
  const [meals, setMeals] = useState<PlannedMeal[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadPlans() {
    const res = await fetch("/api/meal-plan");
    const data = await res.json();
    setSavedPlans(data.plans ?? []);
  }

  useEffect(() => {
    fetch("/api/summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.goal) {
          setTargetCalories(d.goal.calories ?? 2200);
          setTargetProtein(d.goal.proteinG ?? 160);
          setTargetCarbs(d.goal.carbsG ?? 220);
          setTargetFat(d.goal.fatG ?? 70);
        }
      });
    loadPlans();
  }, []);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function generate() {
    setLoading(true);
    setMeals(null);
    try {
      const res = await fetch("/api/meal-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCalories,
          targetProtein,
          targetCarbs,
          targetFat,
          days,
          mealsPerDay,
          cuisine,
          maxMinutes: maxMinutes === "any" ? undefined : Number(maxMinutes),
          tags: selectedTags,
          ingredients: ingredients
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      setMeals(data.meals ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function savePlan() {
    if (!meals) return;
    setSaving(true);
    try {
      await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${days}-Day Plan · ${cuisine === "any" ? "Mixed" : cuisine}`,
          days,
          targetCalories,
          targetProtein,
          targetCarbs,
          targetFat,
          cuisineFilter: cuisine === "any" ? undefined : cuisine,
          maxMinutes: maxMinutes === "any" ? undefined : Number(maxMinutes),
          meals,
        }),
      });
      loadPlans();
    } finally {
      setSaving(false);
    }
  }

  async function logMealToday(recipeId: string, servings: number) {
    await fetch("/api/meal-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: format(new Date(), "yyyy-MM-dd"),
        mealType: "DINNER",
        recipeId,
        servings,
      }),
    });
  }

  async function deletePlan(id: string) {
    setSavedPlans((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/meal-plan?id=${id}`, { method: "DELETE" });
  }

  const mealsByDay = meals
    ? groupBy(meals, (m) => m.day)
    : null;

  return (
    <div>
      <SectionHeading
        title="Meal Plan Generator"
        subtitle="Build a multi-day plan matched to your macros, cuisine, time, and ingredients on hand."
      />

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Daily calories</Label>
            <Input type="number" value={targetCalories} onChange={(e) => setTargetCalories(Number(e.target.value))} />
          </div>
          <div>
            <Label>Protein (g)</Label>
            <Input type="number" value={targetProtein} onChange={(e) => setTargetProtein(Number(e.target.value))} />
          </div>
          <div>
            <Label>Carbs (g)</Label>
            <Input type="number" value={targetCarbs} onChange={(e) => setTargetCarbs(Number(e.target.value))} />
          </div>
          <div>
            <Label>Fat (g)</Label>
            <Input type="number" value={targetFat} onChange={(e) => setTargetFat(Number(e.target.value))} />
          </div>

          <div>
            <Label>Plan length</Label>
            <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[1, 2, 3, 5, 7].map((d) => (
                <option key={d} value={d}>
                  {d} day{d > 1 ? "s" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Meals per day</Label>
            <Select value={mealsPerDay} onChange={(e) => setMealsPerDay(Number(e.target.value) as 3 | 4)}>
              <option value={3}>3 (no snack)</option>
              <option value={4}>4 (with snack)</option>
            </Select>
          </div>
          <div>
            <Label>Cuisine</Label>
            <Select value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
              {CUISINES.map((c) => (
                <option key={c} value={c}>
                  {c === "any" ? "Any cuisine" : c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Max time per meal</Label>
            <Select value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value)}>
              <option value="any">Any</option>
              <option value="20">Under 20 min</option>
              <option value="30">Under 30 min</option>
              <option value="45">Under 45 min</option>
            </Select>
          </div>

          <div className="sm:col-span-2 lg:col-span-2">
            <Label>Ingredients you have (optional)</Label>
            <Input
              placeholder="e.g. chicken, rice, broccoli"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <Label>Preferences</Label>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    selectedTags.includes(tag)
                      ? "border-accent-blue bg-accent-blue/10 text-accent-blue"
                      : "border-border-hairline text-secondary hover:bg-card-hover"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <Button onClick={generate} disabled={loading}>
            <Sparkles size={15} /> {loading ? "Generating..." : "Generate plan"}
          </Button>
          {meals && meals.length > 0 && (
            <Button variant="secondary" onClick={savePlan} disabled={saving}>
              <Save size={15} /> {saving ? "Saving..." : "Save plan"}
            </Button>
          )}
        </div>
      </Card>

      {mealsByDay && (
        <div className="mb-8 space-y-6">
          {Object.entries(mealsByDay).map(([day, dayMeals]) => (
            <div key={day}>
              <h3 className="mb-3 text-sm font-semibold text-secondary">Day {day}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dayMeals
                  .sort((a, b) => DAY_ORDER.indexOf(a.mealType) - DAY_ORDER.indexOf(b.mealType))
                  .map((m, i) => (
                    <MealCard key={i} meal={m} onLog={() => logMealToday(m.recipeId, m.servings)} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {savedPlans.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-secondary">Saved plans</h3>
          <div className="space-y-3">
            {savedPlans.map((p) => (
              <Card key={p.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted">
                    {p.entries.length} meals · saved {format(new Date(p.createdAt), "MMM d")}
                  </p>
                </div>
                <button onClick={() => deletePlan(p.id)} className="text-muted hover:text-accent-red">
                  <Trash2 size={15} />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MealCard({ meal, onLog }: { meal: PlannedMeal; onLog: () => void }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meal.recipe.imageEmoji}</span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{meal.mealType}</p>
            <p className="text-sm font-medium">{meal.recipe.name}</p>
          </div>
        </div>
        <button onClick={onLog} title="Log to today" className="text-muted hover:text-accent-blue">
          <Plus size={16} />
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <Clock size={12} /> {meal.recipe.totalMinutes} min
        <span>·</span>
        {meal.servings}x serving
      </div>
      <div className="flex flex-wrap gap-1">
        {meal.recipe.tags.slice(0, 3).map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-secondary">
        <span>{meal.calories} kcal</span>
        <span>
          P{meal.proteinG} C{meal.carbsG} F{meal.fatG}
        </span>
      </div>
    </Card>
  );
}

function groupBy<T, K extends string | number>(arr: T[], key: (t: T) => K) {
  return arr.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}
