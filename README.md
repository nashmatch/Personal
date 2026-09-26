# Fitful — Nutrition & Fitness Tracker

A MyFitnessPal + Gymverse-style app, deployed on Cloudflare: track macros and
calories, generate meal plans from a public recipe/food database, build and
log workouts against an 876-exercise library with a muscle-group heatmap, set
nutrition/weight/strength/habit goals, and export or sync everything to
Google Sheets. It also ships an MCP server so you can drive the whole app
in plain language from Claude.

## Stack

- **Next.js 16 (App Router) + TypeScript + Tailwind v4** — single full-stack app
- **Cloudflare Workers**, via **[OpenNext](https://opennext.js.org/cloudflare)** — hosting
- **Cloudflare D1** (serverless SQLite) + **Prisma** (`@prisma/adapter-d1`) — database
- **USDA FoodData Central API** (public, free) — live food search, layered on
  a curated local food/recipe library so search works even if that's unreachable
- **[free-exercise-db](https://github.com/yuhonas/free-exercise-db)** (public
  domain / Unlicense) — 876 seeded exercises with muscles, equipment, and
  step-by-step instructions
- **recharts** — progress charts
- **Web Crypto + the Sheets REST API** (no `googleapis`) — Google Sheets export/sync,
  written this way specifically so it runs on Workers
- **@modelcontextprotocol/sdk** — the Claude connector (MCP server), talks to
  the deployed app over HTTP

## Getting started

The app's data lives in Cloudflare D1, so both local development and
production point at a real Cloudflare account. A `fitful` D1 database has
already been provisioned and seeded (876 exercises, ~110 foods, 48 recipes,
a default profile, and a starter nutrition goal) — its ID is already wired up
in `wrangler.jsonc`.

```bash
npm install
npx prisma generate

# Point wrangler at your own Cloudflare account (opens a browser to log in):
npx wrangler login

npm run dev        # http://localhost:3000 — plain `next dev`, D1 via a local proxy
# — or, to run the app exactly as it will on Workers —
npm run preview     # builds + `wrangler dev`, full Workers/D1 simulation, http://localhost:8787
```

`npm run dev` and `npm run preview` both talk to a **local** D1 emulation
(Miniflare, stored in `.wrangler/state/`) by default — separate from the real
data seeded on Cloudflare. To apply the schema and seed data there too:

```bash
# Schema (regenerate scripts/d1-seed's schema file if you change prisma/schema.prisma):
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /tmp/schema.sql
npx wrangler d1 execute fitful --local --file=/tmp/schema.sql

# Seed data (regenerate the SQL files if you change src/data/foods.ts or recipes.ts):
npm run d1:seed:gen
for f in scripts/d1-seed/*.sql; do npx wrangler d1 execute fitful --local --file="$f"; done
```

Or skip local seeding entirely and develop against the real thing with
`npx wrangler dev --remote` (uses your actual Cloudflare D1 database directly —
simplest for a single-user app like this one).

Food search works out of the box using the shared USDA `DEMO_KEY`
(rate-limited) plus the local library; get a free personal key at
https://fdc.nal.usda.gov/api-key-signup.html and set `FDC_API_KEY` (in `.env`
for `next dev`, in `.dev.vars` for `wrangler dev`/preview, or as a Worker
secret in production — see **Deploying to Cloudflare** below).

## Deploying to Cloudflare

```bash
npx wrangler login          # once per machine
npm run deploy               # opennextjs-cloudflare build && wrangler deploy
```

That's it — `wrangler.jsonc` already points at the seeded `fitful` D1
database, so the deployed app has real data from the first request. Wrangler
prints your `*.workers.dev` URL when it finishes.

Set secrets on the deployed Worker (skip any you don't need):

```bash
npx wrangler secret put FDC_API_KEY
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
npx wrangler secret put GOOGLE_SHEET_ID
```

If you want your **own** D1 database instead of the one already wired up
(e.g. you forked this and want a clean slate):

```bash
npx wrangler d1 create fitful-yours
# copy the printed database_id into wrangler.jsonc's d1_databases[0].database_id, then:
npx wrangler d1 execute fitful-yours --remote --file=<schema sql, see above>
npm run d1:seed:gen
for f in scripts/d1-seed/*.sql; do npx wrangler d1 execute fitful-yours --remote --file="$f"; done
```

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
3. Set `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
   and `GOOGLE_SHEET_ID` — as Worker secrets in production (see above), or in
   `.env`/`.dev.vars` locally.
4. Go to **Settings → Google Sheets sync** and hit "Sync" for any dataset. It
   writes/overwrites a dedicated tab (`Nutrition Log`, `Workout Log`,
   `Body Metrics`) each time, so the sheet always mirrors your current data —
   easy to share or review with anyone.

Prefer a one-off file? **Settings → Export to CSV** downloads any of the
three datasets directly, no setup required.

## Claude connector (MCP)

This app ships an MCP server (`mcp-server/index.ts`) that lets Claude read
and write your data through plain language — "log 2 eggs and toast for
breakfast," "build me a 3-day high-protein Mexican meal plan," "log today's
push day: bench 3x8 at 80kg." It talks to your deployed app over HTTP (the
same REST API the web UI uses) rather than the database directly, since D1
is only reachable from inside the Worker.

Add it to your Claude Desktop or Claude Code MCP config, pointing
`FITFUL_API_URL` at your deployed Worker (or `http://localhost:3000` /
`:8787` for local dev):

```json
{
  "mcpServers": {
    "fitful": {
      "command": "npx",
      "args": ["tsx", "mcp-server/index.ts"],
      "cwd": "/absolute/path/to/this/project",
      "env": { "FITFUL_API_URL": "https://fitful.<your-subdomain>.workers.dev" }
    }
  }
}
```

Available tools: `search_foods`, `log_meal`, `log_custom_food`,
`get_daily_summary`, `set_nutrition_goal`, `generate_meal_plan`,
`search_exercises`, `log_workout`, `get_muscle_volume`, `log_body_weight`.

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
data/exercises-source.json Public exercise dataset (source of truth for seeding)
src/data/foods.ts          Curated food macros
src/data/recipes.ts        Curated recipe library
scripts/gen-d1-seed.ts     Generates the SQL files in scripts/d1-seed/ from the data above
scripts/d1-seed/*.sql      Batched INSERT statements — apply with `wrangler d1 execute`
src/lib/                   Prisma/D1 client, USDA client, meal-plan algorithm, Sheets client, muscle map data
src/app/                   Pages (dashboard, nutrition, meal-plan, exercises, workouts, goals, progress, settings)
src/app/api/               REST API the frontend (and the MCP connector) calls
mcp-server/index.ts        The Claude MCP connector — an HTTP client against the deployed API
wrangler.jsonc             Worker config: D1 binding, assets, compatibility flags
open-next.config.ts        OpenNext build config (Cloudflare adapter)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app in dev mode (`next dev`, local D1 via a proxy) |
| `npm run preview` | Build for Cloudflare + run it in `wrangler dev` (closest to production) |
| `npm run deploy` | Build for Cloudflare + `wrangler deploy` |
| `npm run build` / `npm run start` | Plain Next.js production build / serve (no Cloudflare bindings) |
| `npm run cf-typegen` | Regenerate typed bindings from `wrangler.jsonc` |
| `npm run d1:schema:gen` | Print the SQL to create all tables from `prisma/schema.prisma` |
| `npm run d1:seed:gen` | Regenerate `scripts/d1-seed/*.sql` from the data files |
| `npm run mcp` | Run the MCP connector standalone (for debugging) |

## A note on Prisma + Workers

`src/lib/prisma.ts` imports `PrismaClient` from `@prisma/client/wasm` via
`require(...)` rather than a normal `import`. This is deliberate: OpenNext's
build resolves `@prisma/client`'s conditional package exports using Node.js
conditions, which would otherwise pull in the native-binary query engine —
and native binaries don't run on Workers. The explicit `/wasm` subpath forces
the WebAssembly engine build instead, and `require` (not `import`) sidesteps
a missing `.mjs` file for that subpath in this Prisma version. If a future
Prisma release fixes either of those, this can go back to a plain
`import { PrismaClient } from "@prisma/client"`.
