import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { stringify } from "csv-stringify/sync";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const type = req.nextUrl.searchParams.get("type") ?? "meals";

  let rows: string[][] = [];
  let filename = "export.csv";

  if (type === "meals") {
    const logs = await prisma.mealLog.findMany({
      where: { userId: user.id },
      include: { food: true, recipe: true },
      orderBy: { date: "asc" },
    });
    rows = [
      ["Date", "Meal", "Item", "Servings", "Calories", "Protein (g)", "Carbs (g)", "Fat (g)"],
      ...logs.map((l) => [
        l.date.toISOString().slice(0, 10),
        l.mealType,
        l.food?.name ?? l.recipe?.name ?? "Custom",
        String(l.servings),
        l.calories.toFixed(0),
        l.proteinG.toFixed(1),
        l.carbsG.toFixed(1),
        l.fatG.toFixed(1),
      ]),
    ];
    filename = "nutrition-log.csv";
  } else if (type === "workouts") {
    const logs = await prisma.workoutLog.findMany({
      where: { userId: user.id },
      include: { sets: { include: { exercise: true } } },
      orderBy: { date: "asc" },
    });
    rows = [["Date", "Workout", "Exercise", "Set #", "Reps", "Weight (kg)", "RPE", "Warmup"]];
    for (const log of logs) {
      for (const s of log.sets) {
        rows.push([
          log.date.toISOString().slice(0, 10),
          log.name,
          s.exercise.name,
          String(s.setNumber),
          String(s.reps),
          String(s.weightKg),
          s.rpe ? String(s.rpe) : "",
          s.isWarmup ? "Yes" : "No",
        ]);
      }
    }
    filename = "workout-log.csv";
  } else if (type === "weights") {
    const metrics = await prisma.bodyMetric.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    });
    rows = [
      ["Date", "Weight (kg)", "Body Fat %", "Notes"],
      ...metrics.map((m) => [
        m.date.toISOString().slice(0, 10),
        m.weightKg?.toString() ?? "",
        m.bodyFatPct?.toString() ?? "",
        m.notes ?? "",
      ]),
    ];
    filename = "body-metrics.csv";
  } else {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  const csv = stringify(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
