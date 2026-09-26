import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { dayRange, todayKey } from "@/lib/date";

export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  const user = await getCurrentUser();
  const date = req.nextUrl.searchParams.get("date") ?? todayKey();

  const [logs, goal, workoutsToday] = await Promise.all([
    prisma.mealLog.findMany({ where: { userId: user.id, date: dayRange(date) } }),
    prisma.goal.findFirst({
      where: { userId: user.id, kind: "NUTRITION", active: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workoutLog.findMany({ where: { userId: user.id, date: dayRange(date) } }),
  ]);

  const totals = logs.reduce(
    (acc, l) => {
      acc.calories += l.calories;
      acc.proteinG += l.proteinG;
      acc.carbsG += l.carbsG;
      acc.fatG += l.fatG;
      return acc;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return NextResponse.json({
    date,
    totals,
    goal: goal
      ? {
          calories: goal.targetCalories,
          proteinG: goal.targetProtein,
          carbsG: goal.targetCarbs,
          fatG: goal.targetFat,
        }
      : null,
    mealCount: logs.length,
    workoutCount: workoutsToday.length,
  });
}
