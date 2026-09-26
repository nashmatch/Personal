#!/usr/bin/env node
// MCP server exposing this app's nutrition + fitness data to Claude in plain language.
// Run: npx tsx mcp-server/index.ts  (see README "Claude connector" section for client setup)
//
// This talks to the deployed app over HTTP (the same REST API the web UI
// uses) rather than touching the database directly — once the app is
// deployed to Cloudflare, its D1 database is only reachable from inside the
// Worker, so this is the one channel available from a local MCP process.
// Point it at your deployment with the FITFUL_API_URL env var.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MUSCLE_GROUPS } from "../src/lib/muscles";

const API_URL = (process.env.FITFUL_API_URL || "http://localhost:3000").replace(/\/$/, "");

const server = new McpServer({ name: "fitful", version: "0.1.0" });

interface FoodResult {
  id?: string;
  fdcId?: number;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface ExerciseResult {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  primaryMuscles: string[];
}

interface PlannedMealResult {
  day: number;
  mealType: string;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  recipe: { name: string; cuisine: string; totalMinutes: number };
}

function text(payload: unknown) {
  return {
    content: [
      { type: "text" as const, text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) },
    ],
  };
}

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request to ${path} failed (${res.status})`);
  }
  return data;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------- Nutrition ----------------

server.registerTool(
  "search_foods",
  {
    description: "Search the food database (local library + live USDA FoodData Central) by name.",
    inputSchema: { query: z.string().describe("Food name to search for, e.g. 'chicken breast'") },
  },
  async ({ query }) => {
    const data = await api(`/api/foods/search?q=${encodeURIComponent(query)}`);
    return text(data);
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
    const day = date ?? todayKey();
    const search = await api<{ local: FoodResult[]; remote: FoodResult[] }>(
      `/api/foods/search?q=${encodeURIComponent(foodQuery)}`,
    );

    let foodId: string | undefined;
    let foodName: string;

    if (search.local?.length) {
      foodId = search.local[0].id;
      foodName = search.local[0].name;
    } else if (search.remote?.length) {
      const r = search.remote[0];
      const created = await api<{ food: { id: string; name: string } }>("/api/foods", {
        method: "POST",
        body: JSON.stringify({ ...r, source: "USDA" }),
      });
      foodId = created.food.id;
      foodName = created.food.name;
    } else {
      return text(`No food found matching "${foodQuery}". Try a more specific name or use log_custom_food.`);
    }

    const logged = await api<{ log: { calories: number; proteinG: number; carbsG: number; fatG: number } }>(
      "/api/meal-logs",
      { method: "POST", body: JSON.stringify({ date: day, mealType, foodId, servings }) },
    );

    return text(
      `Logged ${servings}x ${foodName} for ${mealType.toLowerCase()} on ${day}: ${Math.round(logged.log.calories)} kcal, P${Math.round(logged.log.proteinG)}g C${Math.round(logged.log.carbsG)}g F${Math.round(logged.log.fatG)}g.`,
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
    const day = date ?? todayKey();
    const created = await api<{ food: { id: string } }>("/api/foods", {
      method: "POST",
      body: JSON.stringify({ name, calories, proteinG, carbsG, fatG, source: "CUSTOM" }),
    });
    const logged = await api<{ log: { calories: number } }>("/api/meal-logs", {
      method: "POST",
      body: JSON.stringify({ date: day, mealType, foodId: created.food.id, servings }),
    });
    return text(`Logged custom food "${name}" (${Math.round(logged.log.calories)} kcal) for ${mealType.toLowerCase()} on ${day}.`);
  },
);

server.registerTool(
  "get_daily_summary",
  {
    description: "Get total calories/macros logged for a day, compared against the active nutrition goal.",
    inputSchema: { date: z.string().optional().describe("ISO date, defaults to today") },
  },
  async ({ date }) => {
    const data = await api(`/api/summary${date ? `?date=${date}` : ""}`);
    return text(data);
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
    await api("/api/goals", {
      method: "POST",
      body: JSON.stringify({
        kind: "NUTRITION",
        name: "Daily Nutrition Target",
        targetCalories: calories,
        targetProtein: proteinG,
        targetCarbs: carbsG,
        targetFat: fatG,
      }),
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
    let { targetCalories, targetProtein, targetCarbs, targetFat } = args;
    if (!targetCalories || !targetProtein || !targetCarbs || !targetFat) {
      const summary = await api<{ goal: { calories: number; proteinG: number; carbsG: number; fatG: number } | null }>(
        "/api/summary",
      );
      targetCalories ??= summary.goal?.calories ?? 2200;
      targetProtein ??= summary.goal?.proteinG ?? 160;
      targetCarbs ??= summary.goal?.carbsG ?? 220;
      targetFat ??= summary.goal?.fatG ?? 70;
    }

    const data = await api<{ meals: PlannedMealResult[] }>("/api/meal-plan/generate", {
      method: "POST",
      body: JSON.stringify({
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
      }),
    });

    return text({
      targets: { targetCalories, targetProtein, targetCarbs, targetFat },
      meals: data.meals.map((m) => ({
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
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (muscle) params.set("muscle", muscle);
    params.set("take", "15");
    const data = await api<{ exercises: ExerciseResult[] }>(`/api/exercises?${params.toString()}`);
    return text(
      data.exercises.map((e) => ({
        name: e.name,
        category: e.category,
        equipment: e.equipment,
        primaryMuscles: e.primaryMuscles,
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
    const setsData: { exerciseId: string; setNumber: number; reps: number; weightKg: number; rpe?: number; isWarmup: boolean }[] =
      [];
    const notFound: string[] = [];
    let matchedCount = 0;

    for (const block of exercises) {
      const found = await api<{ exercises: { id: string }[] }>(
        `/api/exercises?q=${encodeURIComponent(block.exerciseQuery)}&take=1`,
      );
      const exercise = found.exercises[0];
      if (!exercise) {
        notFound.push(block.exerciseQuery);
        continue;
      }
      matchedCount++;
      block.sets.forEach((s, idx) => {
        setsData.push({ exerciseId: exercise.id, setNumber: idx + 1, ...s });
      });
    }

    if (setsData.length === 0) {
      return text(`Couldn't match any exercises (${notFound.join(", ")}). Try search_exercises for the exact name.`);
    }

    const logged = await api<{ log: { name: string; sets: unknown[] } }>("/api/workout-logs", {
      method: "POST",
      body: JSON.stringify({ name, date: date ?? todayKey(), sets: setsData }),
    });

    return text(
      `Logged "${logged.log.name}" with ${logged.log.sets.length} sets across ${matchedCount} exercises.` +
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
    const data = await api(`/api/muscle-volume?days=${days}`);
    return text(data);
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
    const day = date ?? todayKey();
    await api("/api/body-metrics", {
      method: "POST",
      body: JSON.stringify({ date: day, weightKg, bodyFatPct }),
    });
    return text(`Logged body weight: ${weightKg}kg${bodyFatPct ? ` at ${bodyFatPct}% body fat` : ""} on ${day}.`);
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
