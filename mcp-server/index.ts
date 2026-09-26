#!/usr/bin/env node
// MCP server exposing this app's nutrition + fitness data to Claude in plain language.
// Run: npx tsx mcp-server/index.ts  (see README "Claude connector" section for client setup)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getCurrentUser } from "../src/lib/user";
import { dayRange, todayKey } from "../src/lib/date";
import { searchFdcFoods } from "../src/lib/fdc";
import { generateMealPlan } from "../src/lib/mealPlanner";
import { MUSCLE_GROUPS } from "../src/lib/muscles";

const server = new McpServer({ name: "fitful", version: "0.1.0" });

function text(payload: unknown) {
  return { content: [{ type: "text" as const, text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }] };
}

// ---------------- Nutrition ----------------

server.registerTool(
  "search_foods",
  {
    description: "Search the food database (local library + live USDA FoodData Central) by name.",
    inputSchema: { query: z.string().describe("Food name to search for, e.g. 'chicken breast'") },
  },
  async ({ query }) => {
    const [local, remote] = await Promise.all([
      prisma.food.findMany({ where: { name: { contains: query } }, take: 8 }),
      searchFdcFoods(query, 5),
    ]);
    return text({ local, remote });
  },
);

server.registerTool(
  "log_meal",
  {
    description:
      "Log a food to the nutrition diary by name. Finds the closest match in the local library or USDA database and logs it for the given meal.",
    inputSchema: {
      foodQuery: z.string().describe("Name of the food to log, e.g. 'greek yogurt' or 'banana'"),
      mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
      servings: z.number().default(1).describe("Number of servings (default 1)"),
      date: z.string().optional().describe("ISO date (yyyy-MM-dd), defaults to today"),
    },
  },
  async ({ foodQuery, mealType, servings, date }) => {
    const user = await getCurrentUser();
    const day = date ?? todayKey();

    let food = await prisma.food.findFirst({ where: { name: { contains: foodQuery } } });
    if (!food) {
      const remote = await searchFdcFoods(foodQuery, 1);
      if (remote.length === 0) {
        return text(`No food found matching "${foodQuery}". Try a more specific name or use log_custom_food.`);
      }
      const r = remote[0];
      food = await prisma.food.create({
        data: {
          fdcId: r.fdcId,
          name: r.name,
          brand: r.brand,
          source: "USDA",
          servingQty: r.servingQty,
          servingUnit: r.servingUnit,
          gramsPerServing: r.gramsPerServing,
          calories: r.calories,
          proteinG: r.proteinG,
          carbsG: r.carbsG,
          fatG: r.fatG,
          fiberG: r.fiberG,
          sugarG: r.sugarG,
          sodiumMg: r.sodiumMg,
        },
      });
    }

    const log = await prisma.mealLog.create({
      data: {
        userId: user.id,
        date: new Date(day),
        mealType,
        foodId: food.id,
        servings,
        calories: food.calories * servings,
        proteinG: food.proteinG * servings,
        carbsG: food.carbsG * servings,
        fatG: food.fatG * servings,
      },
    });

    return text(
      `Logged ${servings}x ${food.name} for ${mealType.toLowerCase()} on ${day}: ${Math.round(log.calories)} kcal, P${Math.round(log.proteinG)}g C${Math.round(log.carbsG)}g F${Math.round(log.fatG)}g.`,
    );
  },
);

server.registerTool(
  "log_custom_food",
  {
    description: "Log a food that isn't in any database yet, by supplying its macros directly.",
    inputSchema: {
      name: z.string(),
      mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
      calories: z.number(),
      proteinG: z.number(),
      carbsG: z.number(),
      fatG: z.number(),
      servings: z.number().default(1),
      date: z.string().optional(),
    },
  },
  async ({ name, mealType, calories, proteinG, carbsG, fatG, servings, date }) => {
    const user = await getCurrentUser();
    const day = date ?? todayKey();
    const food = await prisma.food.create({
      data: { name, source: "CUSTOM", calories, proteinG, carbsG, fatG },
    });
    const log = await prisma.mealLog.create({
      data: {
        userId: user.id,
        date: new Date(day),
        mealType,
        foodId: food.id,
        servings,
        calories: calories * servings,
        proteinG: proteinG * servings,
        carbsG: carbsG * servings,
        fatG: fatG * servings,
      },
    });
    return text(`Logged custom food "${name}" (${Math.round(log.calories)} kcal) for ${mealType.toLowerCase()} on ${day}.`);
  },
);

server.registerTool(
  "get_daily_summary",
  {
    description: "Get total calories/macros logged for a day, compared against the active nutrition goal.",
    inputSchema: { date: z.string().optional().describe("ISO date, defaults to today") },
  },
  async ({ date }) => {
    const user = await getCurrentUser();
    const day = date ?? todayKey();
    const [logs, goal] = await Promise.all([
      prisma.mealLog.findMany({ where: { userId: user.id, date: dayRange(day) } }),
      prisma.goal.findFirst({ where: { userId: user.id, kind: "NUTRITION", active: true } }),
    ]);
    const totals = logs.reduce(
      (acc, l) => ({
        calories: acc.calories + l.calories,
        proteinG: acc.proteinG + l.proteinG,
        carbsG: acc.carbsG + l.carbsG,
        fatG: acc.fatG + l.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
    return text({
      date: day,
      totals,
      goal: goal
        ? { calories: goal.targetCalories, proteinG: goal.targetProtein, carbsG: goal.targetCarbs, fatG: goal.targetFat }
        : null,
      mealsLogged: logs.length,
    });
  },
);

server.registerTool(
  "set_nutrition_goal",
  {
    description: "Set (or replace) the active daily nutrition targets.",
    inputSchema: {
      calories: z.number(),
      proteinG: z.number(),
      carbsG: z.number(),
      fatG: z.number(),
    },
  },
  async ({ calories, proteinG, carbsG, fatG }) => {
    const user = await getCurrentUser();
    await prisma.goal.updateMany({ where: { userId: user.id, kind: "NUTRITION", active: true }, data: { active: false } });
    await prisma.goal.create({
      data: {
        userId: user.id,
        kind: "NUTRITION",
        name: "Daily Nutrition Target",
        targetCalories: calories,
        targetProtein: proteinG,
        targetCarbs: carbsG,
        targetFat: fatG,
      },
    });
    return text(`Nutrition goal set: ${calories} kcal, P${proteinG}g C${carbsG}g F${fatG}g per day.`);
  },
);

server.registerTool(
  "generate_meal_plan",
  {
    description:
      "Generate a multi-day meal plan matched to macro targets, cuisine, prep time, and ingredients on hand. If targets are omitted, uses the active nutrition goal.",
    inputSchema: {
      days: z.number().min(1).max(7).default(3),
      mealsPerDay: z.union([z.literal(3), z.literal(4)]).default(3),
      cuisine: z.string().optional().describe("e.g. Italian, Mexican, Asian, American, Mediterranean, Indian"),
      maxMinutes: z.number().optional().describe("Max total prep+cook time per meal"),
      tags: z.array(z.string()).optional().describe("e.g. vegetarian, vegan, high-protein, low-carb, quick"),
      ingredients: z.array(z.string()).optional().describe("Ingredients on hand to prioritize"),
      targetCalories: z.number().optional(),
      targetProtein: z.number().optional(),
      targetCarbs: z.number().optional(),
      targetFat: z.number().optional(),
    },
  },
  async (args) => {
    const user = await getCurrentUser();
    let { targetCalories, targetProtein, targetCarbs, targetFat } = args;
    if (!targetCalories || !targetProtein || !targetCarbs || !targetFat) {
      const goal = await prisma.goal.findFirst({ where: { userId: user.id, kind: "NUTRITION", active: true } });
      targetCalories ??= goal?.targetCalories ?? 2200;
      targetProtein ??= goal?.targetProtein ?? 160;
      targetCarbs ??= goal?.targetCarbs ?? 220;
      targetFat ??= goal?.targetFat ?? 70;
    }
    const meals = await generateMealPlan({
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
      days: args.days,
      mealsPerDay: args.mealsPerDay,
      cuisine: args.cuisine,
      maxMinutes: args.maxMinutes,
      tags: args.tags,
      ingredients: args.ingredients,
    });
    return text({
      targets: { targetCalories, targetProtein, targetCarbs, targetFat },
      meals: meals.map((m) => ({
        day: m.day,
        mealType: m.mealType,
        recipe: m.recipe.name,
        cuisine: m.recipe.cuisine,
        minutes: m.recipe.totalMinutes,
        servings: m.servings,
        calories: m.calories,
        proteinG: m.proteinG,
        carbsG: m.carbsG,
        fatG: m.fatG,
      })),
    });
  },
);

// ---------------- Fitness ----------------

server.registerTool(
  "search_exercises",
  {
    description: "Search the exercise library (876 exercises) by name and/or muscle group.",
    inputSchema: {
      query: z.string().optional(),
      muscle: z.enum(MUSCLE_GROUPS).optional(),
    },
  },
  async ({ query, muscle }) => {
    const where: Prisma.ExerciseWhereInput = {};
    if (query) where.name = { contains: query };
    if (muscle) where.primaryMuscles = { contains: muscle };
    const exercises = await prisma.exercise.findMany({ where, take: 15 });
    return text(
      exercises.map((e) => ({
        name: e.name,
        category: e.category,
        equipment: e.equipment,
        primaryMuscles: JSON.parse(e.primaryMuscles),
      })),
    );
  },
);

server.registerTool(
  "log_workout",
  {
    description:
      "Log a completed workout. Each exercise is matched by name to the exercise library; provide sets with reps and weight (kg).",
    inputSchema: {
      name: z.string().default("Workout"),
      date: z.string().optional(),
      exercises: z.array(
        z.object({
          exerciseQuery: z.string().describe("Exercise name, e.g. 'bench press'"),
          sets: z.array(
            z.object({
              reps: z.number(),
              weightKg: z.number().default(0),
              rpe: z.number().optional(),
              isWarmup: z.boolean().default(false),
            }),
          ),
        }),
      ),
    },
  },
  async ({ name, date, exercises }) => {
    const user = await getCurrentUser();
    const setsData: {
      exerciseId: string;
      setNumber: number;
      reps: number;
      weightKg: number;
      rpe?: number;
      isWarmup: boolean;
    }[] = [];
    const notFound: string[] = [];

    for (const block of exercises) {
      const exercise = await prisma.exercise.findFirst({ where: { name: { contains: block.exerciseQuery } } });
      if (!exercise) {
        notFound.push(block.exerciseQuery);
        continue;
      }
      block.sets.forEach((s, idx) => {
        setsData.push({ exerciseId: exercise.id, setNumber: idx + 1, ...s });
      });
    }

    if (setsData.length === 0) {
      return text(`Couldn't match any exercises (${notFound.join(", ")}). Try search_exercises for the exact name.`);
    }

    const log = await prisma.workoutLog.create({
      data: {
        userId: user.id,
        name,
        date: new Date(date ?? todayKey()),
        sets: { create: setsData },
      },
      include: { sets: { include: { exercise: true } } },
    });

    return text(
      `Logged "${log.name}" with ${log.sets.length} sets across ${exercises.length - notFound.length} exercises.` +
        (notFound.length ? ` Skipped (not found): ${notFound.join(", ")}.` : ""),
    );
  },
);

server.registerTool(
  "get_muscle_volume",
  {
    description: "Get training volume (sets) per muscle group over the last N days — useful for spotting imbalances.",
    inputSchema: { days: z.number().default(7) },
  },
  async ({ days }) => {
    const user = await getCurrentUser();
    const since = new Date(Date.now() - days * 86400000);
    const logs = await prisma.workoutLog.findMany({
      where: { userId: user.id, date: { gte: since } },
      include: { sets: { include: { exercise: true } } },
    });
    const sets: Record<string, number> = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0]));
    for (const log of logs) {
      for (const set of log.sets) {
        if (set.isWarmup) continue;
        for (const m of JSON.parse(set.exercise.primaryMuscles)) sets[m] += 1;
        for (const m of JSON.parse(set.exercise.secondaryMuscles)) sets[m] += 0.5;
      }
    }
    return text({ days, sets });
  },
);

server.registerTool(
  "log_body_weight",
  {
    description: "Log a body weight (and optionally body fat %) reading.",
    inputSchema: {
      weightKg: z.number(),
      bodyFatPct: z.number().optional(),
      date: z.string().optional(),
    },
  },
  async ({ weightKg, bodyFatPct, date }) => {
    const user = await getCurrentUser();
    await prisma.bodyMetric.create({
      data: { userId: user.id, date: new Date(date ?? todayKey()), weightKg, bodyFatPct },
    });
    return text(`Logged body weight: ${weightKg}kg${bodyFatPct ? ` at ${bodyFatPct}% body fat` : ""} on ${date ?? todayKey()}.`);
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fitful MCP server failed to start:", err);
  process.exit(1);
});
