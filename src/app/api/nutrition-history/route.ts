import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { subDays, format } from "date-fns";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
  const since = subDays(new Date(), days);

  const logs = await prisma.mealLog.findMany({
    where: { userId: user.id, date: { gte: since } },
    orderBy: { date: "asc" },
  });

  const byDay = new Map<string, { calories: number; proteinG: number; carbsG: number; fatG: number }>();
  for (const log of logs) {
    const key = format(log.date, "yyyy-MM-dd");
    const entry = byDay.get(key) ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    entry.calories += log.calories;
    entry.proteinG += log.proteinG;
    entry.carbsG += log.carbsG;
    entry.fatG += log.fatG;
    byDay.set(key, entry);
  }

  const series = Array.from({ length: days }, (_, i) => {
    const date = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
    const entry = byDay.get(date);
    return {
      date,
      calories: Math.round(entry?.calories ?? 0),
      proteinG: Math.round(entry?.proteinG ?? 0),
      carbsG: Math.round(entry?.carbsG ?? 0),
      fatG: Math.round(entry?.fatG ?? 0),
    };
  });

  return NextResponse.json({ series });
}
