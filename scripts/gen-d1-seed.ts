// Generates batched SQL INSERT files for seeding the Cloudflare D1 database,
// mirroring prisma/seed.ts but emitting raw SQL (since D1 is seeded via the
// Cloudflare MCP tool / wrangler d1 execute, not the Prisma client directly).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { FOOD_ROWS } from "../src/data/foods";
import { RECIPES } from "../src/data/recipes";

const OUT_DIR = path.join(process.cwd(), "scripts", "d1-seed");
fs.mkdirSync(OUT_DIR, { recursive: true });

function id() {
  return crypto.randomUUID().replace(/-/g, "");
}

function sqlStr(v: string | null | undefined): string {
  if (v == null) return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}
function sqlNum(v: number | null | undefined): string {
  if (v == null) return "NULL";
  return String(v);
}
function titleCase(s: string) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function writeChunks(prefix: string, columns: string, table: string, rows: string[], perFile: number, rowsPerInsert: number) {
  const rowChunks = chunk(rows, rowsPerInsert);
  const statements = rowChunks.map((rc) => `INSERT INTO "${table}" (${columns}) VALUES\n${rc.join(",\n")};`);
  const fileChunks = chunk(statements, perFile);
  fileChunks.forEach((stmts, i) => {
    const file = path.join(OUT_DIR, `${prefix}-${String(i + 1).padStart(2, "0")}.sql`);
    fs.writeFileSync(file, stmts.join("\n\n") + "\n");
  });
  console.log(`${prefix}: ${rows.length} rows -> ${fileChunks.length} file(s)`);
}

// ---------------- Exercises ----------------
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

const exercisesRaw: SourceExercise[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "exercises-source.json"), "utf-8"),
);

const exerciseIds: string[] = [];
const exerciseRows = exercisesRaw.map((ex) => {
  const eid = id();
  exerciseIds.push(eid);
  return `(${sqlStr(eid)}, ${sqlStr(ex.name)}, ${sqlStr(ex.category)}, ${sqlStr(ex.equipment)}, ${sqlStr(
    JSON.stringify(ex.primaryMuscles.map(titleCase)),
  )}, ${sqlStr(JSON.stringify(ex.secondaryMuscles.map(titleCase)))}, ${sqlStr(ex.force)}, ${sqlStr(
    ex.level,
  )}, ${sqlStr(ex.mechanic)}, ${sqlStr(ex.instructions.join("\n"))})`;
});

writeChunks(
  "01-exercises",
  `"id","name","category","equipment","primaryMuscles","secondaryMuscles","force","level","mechanic","instructions"`,
  "Exercise",
  exerciseRows,
  4,
  40,
);

// ---------------- Foods ----------------
const foodIds: string[] = [];
const foodRows = FOOD_ROWS.map((row) => {
  const [name, servingQty, servingUnit, gramsPerServing, calories, proteinG, carbsG, fatG, fiberG, sugarG, sodiumMg] = row;
  const fid = id();
  foodIds.push(fid);
  return `(${sqlStr(fid)}, ${sqlStr(name)}, 'CUSTOM', ${sqlNum(servingQty)}, ${sqlStr(servingUnit)}, ${sqlNum(
    gramsPerServing,
  )}, ${sqlNum(calories)}, ${sqlNum(proteinG)}, ${sqlNum(carbsG)}, ${sqlNum(fatG)}, ${sqlNum(fiberG)}, ${sqlNum(
    sugarG,
  )}, ${sqlNum(sodiumMg)})`;
});
const foodNameToId = new Map(FOOD_ROWS.map((row, i) => [row[0].toLowerCase(), foodIds[i]]));

writeChunks(
  "02-foods",
  `"id","name","source","servingQty","servingUnit","gramsPerServing","calories","proteinG","carbsG","fatG","fiberG","sugarG","sodiumMg"`,
  "Food",
  foodRows,
  10,
  50,
);

// ---------------- Recipes + Ingredients ----------------
const recipeRows: string[] = [];
const ingredientRows: string[] = [];

for (const r of RECIPES) {
  const rid = id();
  recipeRows.push(
    `(${sqlStr(rid)}, ${sqlStr(r.name)}, ${sqlStr(r.cuisine)}, ${sqlNum(r.prepMinutes)}, ${sqlNum(
      r.cookMinutes,
    )}, ${sqlNum(r.prepMinutes + r.cookMinutes)}, ${sqlNum(r.servings)}, ${sqlNum(r.caloriesPerServing)}, ${sqlNum(
      r.proteinG,
    )}, ${sqlNum(r.carbsG)}, ${sqlNum(r.fatG)}, ${sqlNum(r.fiberG)}, ${sqlStr(JSON.stringify(r.tags))}, ${sqlStr(
      r.instructions.join("\n"),
    )}, ${sqlStr(r.imageEmoji)})`,
  );
  for (const ing of r.ingredients) {
    const iid = id();
    const foodId = foodNameToId.get(ing.name.toLowerCase()) ?? null;
    ingredientRows.push(
      `(${sqlStr(iid)}, ${sqlStr(rid)}, ${foodId ? sqlStr(foodId) : "NULL"}, ${sqlStr(ing.name)}, ${sqlNum(
        ing.quantity,
      )}, ${sqlStr(ing.unit)})`,
    );
  }
}

writeChunks(
  "03-recipes",
  `"id","name","cuisine","prepMinutes","cookMinutes","totalMinutes","servings","caloriesPerServing","proteinG","carbsG","fatG","fiberG","tagsJson","instructions","imageEmoji"`,
  "Recipe",
  recipeRows,
  5,
  20,
);

writeChunks(
  "04-ingredients",
  `"id","recipeId","foodId","name","quantity","unit"`,
  "RecipeIngredient",
  ingredientRows,
  5,
  50,
);

// ---------------- Default user + nutrition goal ----------------
const userId = id();
const goalId = id();
fs.writeFileSync(
  path.join(OUT_DIR, "05-user-goal.sql"),
  [
    `INSERT INTO "User" ("id","name","email","unitPref") VALUES (${sqlStr(userId)}, 'You', 'you@example.com', 'imperial');`,
    `INSERT INTO "Goal" ("id","userId","kind","name","active","targetCalories","targetProtein","targetCarbs","targetFat") VALUES (${sqlStr(
      goalId,
    )}, ${sqlStr(userId)}, 'NUTRITION', 'Daily Nutrition Target', 1, 2200, 160, 220, 70);`,
  ].join("\n") + "\n",
);

console.log("Default user id:", userId);
console.log("Done. SQL files written to", OUT_DIR);
