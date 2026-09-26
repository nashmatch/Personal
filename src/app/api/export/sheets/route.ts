import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { writeSheetTab, isSheetsConfigured } from "@/lib/sheets";

export async function GET() {
  return NextResponse.json({ configured: isSheetsConfigured() });
}

export async function POST(req: NextRequest) {
  if (!isSheetsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google Sheets isn't configured yet. Add GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_SHEET_ID to your .env (see README for setup steps).",
      },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  const { type } = await req.json();

  try {
    let result;
    if (type === "meals") {
      const logs = await prisma.mealLog.findMany({
        where: { userId: user.id },
        include: { food: true, recipe: true },
        orderBy: { date: "asc" },
      });
      const rows = [
        ["Date", "Meal", "Item", "Servings", "Calories", "Protein (g)", "Carbs (g)", "Fat (g)"],
        ...logs.map((l) => [
          l.date.toISOString().slice(0, 10),
          l.mealType,
          l.food?.name ?? l.recipe?.name ?? "Custom",
          l.servings,
          Math.round(l.calories),
          Math.round(l.proteinG * 10) / 10,
          Math.round(l.carbsG * 10) / 10,
          Math.round(l.fatG * 10) / 10,
        ]),
      ];
      result = await writeSheetTab("Nutrition Log", rows);
    } else if (type === "workouts") {
      const logs = await prisma.workoutLog.findMany({
        where: { userId: user.id },
        include: { sets: { include: { exercise: true } } },
        orderBy: { date: "asc" },
      });
      const rows: (string | number)[][] = [
        ["Date", "Workout", "Exercise", "Set #", "Reps", "Weight (kg)", "RPE", "Warmup"],
      ];
      for (const log of logs) {
        for (const s of log.sets) {
          rows.push([
            log.date.toISOString().slice(0, 10),
            log.name,
            s.exercise.name,
            s.setNumber,
            s.reps,
            s.weightKg,
            s.rpe ?? "",
            s.isWarmup ? "Yes" : "No",
          ]);
        }
      }
      result = await writeSheetTab("Workout Log", rows);
    } else if (type === "weights") {
      const metrics = await prisma.bodyMetric.findMany({
        where: { userId: user.id },
        orderBy: { date: "asc" },
      });
      const rows = [
        ["Date", "Weight (kg)", "Body Fat %", "Notes"],
        ...metrics.map((m) => [
          m.date.toISOString().slice(0, 10),
          m.weightKg ?? "",
          m.bodyFatPct ?? "",
          m.notes ?? "",
        ]),
      ];
      result = await writeSheetTab("Body Metrics", rows);
    } else {
      return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sheets sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
