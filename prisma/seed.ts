import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { FOOD_ROWS } from "../src/data/foods";
import { RECIPES } from "../src/data/recipes";

const prisma = new PrismaClient();

interface SourceExercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
}

function titleCase(s: string) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

async function seedUser() {
  const user = await prisma.user.upsert({
    where: { email: "you@example.com" },
    update: {},
    create: {
      name: "You",
      email: "you@example.com",
      unitPref: "imperial",
    },
  });
  return user;
}

async function seedExercises() {
  const filePath = path.join(process.cwd(), "data", "exercises-source.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const source: SourceExercise[] = JSON.parse(raw);

  console.log(`Seeding ${source.length} exercises...`);

  const batchSize = 50;
  for (let i = 0; i < source.length; i += batchSize) {
    const batch = source.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((ex) =>
        prisma.exercise.create({
          data: {
            name: ex.name,
            category: ex.category,
            equipment: ex.equipment ?? undefined,
            primaryMuscles: JSON.stringify(ex.primaryMuscles.map(titleCase)),
            secondaryMuscles: JSON.stringify(ex.secondaryMuscles.map(titleCase)),
            force: ex.force ?? undefined,
            level: ex.level,
            mechanic: ex.mechanic ?? undefined,
            instructions: ex.instructions.join("\n"),
          },
        }),
      ),
    );
  }
}

async function seedFoods() {
  console.log(`Seeding ${FOOD_ROWS.length} foods...`);
  for (const row of FOOD_ROWS) {
    const [name, servingQty, servingUnit, gramsPerServing, calories, proteinG, carbsG, fatG, fiberG, sugarG, sodiumMg] = row;
    await prisma.food.create({
      data: {
        name,
        source: "CUSTOM",
        servingQty,
        servingUnit,
        gramsPerServing,
        calories,
        proteinG,
        carbsG,
        fatG,
        fiberG: fiberG ?? undefined,
        sugarG: sugarG ?? undefined,
        sodiumMg: sodiumMg ?? undefined,
      },
    });
  }
}

async function seedRecipes() {
  console.log(`Seeding ${RECIPES.length} recipes...`);
  const foods = await prisma.food.findMany({ select: { id: true, name: true } });
  const foodByName = new Map(foods.map((f) => [f.name.toLowerCase(), f.id]));

  for (const recipe of RECIPES) {
    await prisma.recipe.create({
      data: {
        name: recipe.name,
        cuisine: recipe.cuisine,
        prepMinutes: recipe.prepMinutes,
        cookMinutes: recipe.cookMinutes,
        totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
        servings: recipe.servings,
        caloriesPerServing: recipe.caloriesPerServing,
        proteinG: recipe.proteinG,
        carbsG: recipe.carbsG,
        fatG: recipe.fatG,
        fiberG: recipe.fiberG ?? undefined,
        tagsJson: JSON.stringify(recipe.tags),
        instructions: recipe.instructions.join("\n"),
        imageEmoji: recipe.imageEmoji,
        ingredients: {
          create: recipe.ingredients.map((ing) => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            foodId: foodByName.get(ing.name.toLowerCase()) ?? null,
          })),
        },
      },
    });
  }
}

async function main() {
  console.log("Clearing existing data...");
  await prisma.setLog.deleteMany();
  await prisma.workoutLog.deleteMany();
  await prisma.workoutTemplateExercise.deleteMany();
  await prisma.workoutTemplate.deleteMany();
  await prisma.mealPlanEntry.deleteMany();
  await prisma.mealPlan.deleteMany();
  await prisma.mealLog.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.food.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.bodyMetric.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.user.deleteMany();

  const user = await seedUser();
  await seedExercises();
  await seedFoods();
  await seedRecipes();

  await prisma.goal.create({
    data: {
      userId: user.id,
      kind: "NUTRITION",
      name: "Daily Nutrition Target",
      targetCalories: 2200,
      targetProtein: 160,
      targetCarbs: 220,
      targetFat: 70,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
