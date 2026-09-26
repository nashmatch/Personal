import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { subDays, format } from "date-fns";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
  const since = subDays(new Date(), days);

  const logs = await prisma.workoutLog.findMany({
    where: { userId: user.id, date: { gte: since } },
    include: { sets: true },
    orderBy: { date: "asc" },
  });

  const byDay = new Map<string, number>();
  for (const log of logs) {
    const key = format(log.date, "yyyy-MM-dd");
    const tonnage = log.sets.reduce((sum, s) => (s.isWarmup ? sum : sum + s.reps * s.weightKg), 0);
    byDay.set(key, (byDay.get(key) ?? 0) + tonnage);
  }

  const series = Array.from({ length: days }, (_, i) => {
    const date = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
    return { date, volumeKg: Math.round(byDay.get(date) ?? 0) };
  });

  return NextResponse.json({ series });
}
