import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { MUSCLE_GROUPS } from "@/lib/muscles";
import { subDays } from "date-fns";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const days = Number(req.nextUrl.searchParams.get("days") ?? 7);
  const since = subDays(new Date(), days);

  const logs = await prisma.workoutLog.findMany({
    where: { userId: user.id, date: { gte: since } },
    include: { sets: { include: { exercise: true } } },
  });

  const sets: Record<string, number> = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0]));
  const volume: Record<string, number> = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0]));

  for (const log of logs) {
    for (const set of log.sets) {
      if (set.isWarmup) continue;
      const primary: string[] = JSON.parse(set.exercise.primaryMuscles);
      const secondary: string[] = JSON.parse(set.exercise.secondaryMuscles);
      const tonnage = set.reps * (set.weightKg || 1);

      for (const m of primary) {
        if (sets[m] === undefined) continue;
        sets[m] += 1;
        volume[m] += tonnage;
      }
      for (const m of secondary) {
        if (sets[m] === undefined) continue;
        sets[m] += 0.5;
        volume[m] += tonnage * 0.5;
      }
    }
  }

  const maxSets = Math.max(1, ...Object.values(sets));

  const muscles = MUSCLE_GROUPS.map((m) => ({
    muscle: m,
    sets: Math.round(sets[m] * 10) / 10,
    volume: Math.round(volume[m]),
    ratio: sets[m] / maxSets,
  }));

  return NextResponse.json({ days, muscles, workoutCount: logs.length });
}
