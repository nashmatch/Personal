import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface MealPlanTargets {
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  days: number;
  mealsPerDay: 3 | 4;
  cuisine?: string; // "any" or a specific cuisine
  maxMinutes?: number;
  tags?: string[]; // e.g. ["vegetarian"]
  ingredients?: string[]; // must contain at least one of these
}

const MEAL_SPLITS_3 = [
  { mealType: "BREAKFAST", share: 0.28 },
  { mealType: "LUNCH", share: 0.36 },
  { mealType: "DINNER", share: 0.36 },
];

const MEAL_SPLITS_4 = [
  { mealType: "BREAKFAST", share: 0.24 },
  { mealType: "LUNCH", share: 0.32 },
  { mealType: "DINNER", share: 0.32 },
  { mealType: "SNACK", share: 0.12 },
];

const SERVING_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5];

export interface PlannedMeal {
  day: number;
  mealType: string;
  recipeId: string;
  servings: number;
  recipe: {
    id: string;
    name: string;
    cuisine: string;
    totalMinutes: number;
    imageEmoji: string;
    tags: string[];
  };
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export async function generateMealPlan(targets: MealPlanTargets) {
  const prisma = await getPrisma();
  const where: Prisma.RecipeWhereInput = {};
  if (targets.cuisine && targets.cuisine !== "any") where.cuisine = targets.cuisine;
  if (targets.maxMinutes) where.totalMinutes = { lte: targets.maxMinutes };

  let pool = await prisma.recipe.findMany({ where, include: { ingredients: true } });

  if (targets.tags?.length) {
    pool = pool.filter((r) => {
      const rTags: string[] = JSON.parse(r.tagsJson);
      return targets.tags!.every((t) => rTags.includes(t));
    });
  }

  if (targets.ingredients?.length) {
    const wanted = targets.ingredients.map((s) => s.toLowerCase());
    const withIngredient = pool.filter((r) =>
      r.ingredients.some((ing) => wanted.some((w) => ing.name.toLowerCase().includes(w))),
    );
    // Only narrow the pool if it doesn't wipe out all options entirely.
    if (withIngredient.length >= Math.min(6, pool.length)) pool = withIngredient;
    else if (withIngredient.length > 0) pool = withIngredient;
  }

  if (pool.length === 0) {
    // Fall back to the full recipe library so a plan can still be generated.
    pool = await prisma.recipe.findMany({ include: { ingredients: true } });
  }

  const splits = targets.mealsPerDay === 4 ? MEAL_SPLITS_4 : MEAL_SPLITS_3;
  const meals: PlannedMeal[] = [];
  const usageCount = new Map<string, number>();

  for (let day = 1; day <= targets.days; day++) {
    const usedToday = new Set<string>();
    for (const slot of splits) {
      const calTarget = targets.targetCalories * slot.share;
      const proteinTarget = targets.targetProtein * slot.share;
      const carbTarget = targets.targetCarbs * slot.share;
      const fatTarget = targets.targetFat * slot.share;

      let best: { recipe: (typeof pool)[number]; servings: number; score: number } | null = null;

      for (const recipe of pool) {
        for (const s of SERVING_STEPS) {
          const cal = recipe.caloriesPerServing * s;
          const protein = recipe.proteinG * s;
          const carbs = recipe.carbsG * s;
          const fat = recipe.fatG * s;

          const err =
            ((cal - calTarget) / Math.max(calTarget, 1)) ** 2 +
            ((protein - proteinTarget) / Math.max(proteinTarget, 1)) ** 2 +
            ((carbs - carbTarget) / Math.max(carbTarget, 1)) ** 2 +
            ((fat - fatTarget) / Math.max(fatTarget, 1)) ** 2;

          const repeatPenalty = usedToday.has(recipe.id) ? 2 : (usageCount.get(recipe.id) ?? 0) * 0.15;
          const score = err + repeatPenalty;

          if (!best || score < best.score) {
            best = { recipe, servings: s, score };
          }
        }
      }

      if (best) {
        usedToday.add(best.recipe.id);
        usageCount.set(best.recipe.id, (usageCount.get(best.recipe.id) ?? 0) + 1);
        meals.push({
          day,
          mealType: slot.mealType,
          recipeId: best.recipe.id,
          servings: best.servings,
          recipe: {
            id: best.recipe.id,
            name: best.recipe.name,
            cuisine: best.recipe.cuisine,
            totalMinutes: best.recipe.totalMinutes,
            imageEmoji: best.recipe.imageEmoji,
            tags: JSON.parse(best.recipe.tagsJson),
          },
          calories: Math.round(best.recipe.caloriesPerServing * best.servings),
          proteinG: Math.round(best.recipe.proteinG * best.servings),
          carbsG: Math.round(best.recipe.carbsG * best.servings),
          fatG: Math.round(best.recipe.fatG * best.servings),
        });
      }
    }
  }

  return meals;
}
