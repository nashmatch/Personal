# Fitful — Nutrition & Fitness Tracker

A self-hosted MyFitnessPal + Gymverse-style app: track macros and calories,
generate meal plans from a public recipe/food database, build and log
workouts against an 876-exercise library with a muscle-group heatmap, set
nutrition/weight/strength/habit goals, and export or sync everything to
Google Sheets. It also ships an MCP server so you can drive the whole app
in plain language from Claude.

## Stack

- **Next.js 16 (App Router) + TypeScript + Tailwind v4** — single full-stack app
- **Prisma + SQLite** — local, zero-config database (`prisma/dev.db`)
- **USDA FoodData Central API** (public, free) — live food search, layered on
  a curated local food/recipe library so search works offline too
- **[free-exercise-db](https://github.com/yuhonas/free-exercise-db)** (public
  domain / Unlicense) — 876 seeded exercises with muscles, equipment, and
  step-by-step instructions
- **recharts** — progress charts
- **googleapis** — Google Sheets export/sync
- **@modelcontextprotocol/sdk** — the Claude connector (MCP server)

## Getting started

```bash
npm install
npm run db:push      # create the SQLite schema
npm run db:seed      # seed 876 exercises, ~110 foods, 48 recipes
npm run dev           # http://localhost:3000
```

That's it — no external accounts required. Food search works out of the box
using the shared USDA `DEMO_KEY` (rate-limited) plus the local library; get a
free personal key at https://fdc.nal.usda.gov/api-key-signup.html and set
`FDC_API_KEY` in `.env` for higher limits.

## Features

- **Nutrition** — daily diary by meal, calorie ring + macro bars, food search
  (local + live USDA), custom foods.
- **Meal Plan Generator** — builds a multi-day plan from macro targets,
  cuisine (Italian/Mexican/Asian/American/Mediterranean/Indian), max prep
  time, dietary tags (vegetarian/vegan/high-protein/low-carb/quick), and
  ingredients you already have. Log any generated meal straight to today's
  diary, or save the whole plan.
- **Exercise Library** — search/filter 876 exercises by muscle, category,
  equipment, or level; full instructions per exercise.
- **Workouts** — build reusable templates, log sets (reps/weight/RPE/warmup),
  workout history, and a front/back body heatmap showing which muscles
  you've trained over the last 7/14/30 days.
- **Goals** — nutrition targets, target body weight, a specific lift
  (e.g. "bench press 100kg × 5"), or a weekly workout habit — each with
  automatic progress tracking.
- **Progress** — body weight, calories-vs-goal, and training volume trends.
- **Export & Google Sheets** — CSV download for nutrition/workout/weight
  history, or push it directly into a live Google Sheet (see below).
- **Claude connector (MCP)** — control the app in plain language (see below).

## Google Sheets sync (optional)

1. In Google Cloud Console, create a project → enable the **Google Sheets
   API** → create a **Service Account** → create a JSON key for it.
2. Create a new Google Sheet, and share it with the service account's
   `...@...iam.gserviceaccount.com` email (Editor access).
3. In `.env`, set:
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEET_ID=the-id-from-the-sheet-url
   ```
4. Restart the app, then go to **Settings → Google Sheets sync** and hit
   "Sync" for any dataset. It writes/overwrites a dedicated tab
   (`Nutrition Log`, `Workout Log`, `Body Metrics`) each time, so the sheet
   always mirrors your current data — easy to share or review with anyone.

Prefer a one-off file? **Settings → Export to CSV** downloads any of the
three datasets directly, no setup required.

## Claude connector (MCP)

This app ships an MCP server (`mcp-server/index.ts`) that lets Claude read
and write your data through plain language — "log 2 eggs and toast for
breakfast," "build me a 3-day high-protein Mexican meal plan," "log today's
push day: bench 3x8 at 80kg."

Add it to your Claude Desktop or Claude Code MCP config:

```json
{
  "mcpServers": {
    "fitful": {
      "command": "npx",
      "args": ["tsx", "mcp-server/index.ts"],
      "cwd": "/absolute/path/to/this/project"
    }
  }
}
```

It shares the same SQLite database as the web app, so anything logged
through Claude shows up immediately in the UI and vice versa. Available
tools: `search_foods`, `log_meal`, `log_custom_food`, `get_daily_summary`,
`set_nutrition_goal`, `generate_meal_plan`, `search_exercises`,
`log_workout`, `get_muscle_volume`, `log_body_weight`.

## Data sources & attribution

- Exercise library: [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
  (Unlicense / public domain), bundled at `data/exercises-source.json`.
- Food macros: a curated reference dataset (`src/data/foods.ts`) plus live
  results from the public **USDA FoodData Central** API.
- Recipes: an original 48-recipe library (`src/data/recipes.ts`) spanning six
  cuisines, written for this app.

## Project structure

```
prisma/schema.prisma       Data model (users, foods, recipes, exercises, workouts, goals...)
prisma/seed.ts             Seeds exercises + foods + recipes into SQLite
data/exercises-source.json Public exercise dataset (source of truth for seeding)
src/data/foods.ts          Curated food macros
src/data/recipes.ts        Curated recipe library
src/lib/                   Prisma client, USDA client, meal-plan algorithm, Sheets client, muscle map data
src/app/                   Pages (dashboard, nutrition, meal-plan, exercises, workouts, goals, progress, settings)
src/app/api/               REST API the frontend (and nothing else) calls
mcp-server/index.ts        The Claude MCP connector — talks to the same DB directly
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app in dev mode |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run db:push` | Sync `prisma/schema.prisma` to the SQLite file |
| `npm run db:seed` | Re-seed exercises/foods/recipes (safe to re-run; clears and reloads) |
| `npm run db:studio` | Open Prisma Studio to browse/edit the database |
| `npm run mcp` | Run the MCP connector standalone (for debugging) |
