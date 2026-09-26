import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  const user = await getCurrentUser();
  const take = Number(req.nextUrl.searchParams.get("take") ?? 30);
  const logs = await prisma.workoutLog.findMany({
    where: { userId: user.id },
    include: { sets: { include: { exercise: true } }, template: true },
    orderBy: { date: "desc" },
    take,
  });
  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  const user = await getCurrentUser();
  const body = await req.json();
  const { name, date, templateId, durationMinutes, notes, sets } = body;

  const log = await prisma.workoutLog.create({
    data: {
      userId: user.id,
      name: name || "Workout",
      date: new Date(date ?? new Date()),
      templateId: templateId ?? undefined,
      durationMinutes: durationMinutes ?? undefined,
      notes: notes ?? undefined,
      sets: {
        create: (sets ?? []).map(
          (
            s: { exerciseId: string; setNumber?: number; reps: number; weightKg?: number; rpe?: number; isWarmup?: boolean },
            idx: number,
          ) => ({
          exerciseId: s.exerciseId,
          setNumber: s.setNumber ?? idx + 1,
          reps: s.reps,
          weightKg: s.weightKg ?? 0,
          rpe: s.rpe ?? undefined,
          isWarmup: s.isWarmup ?? false,
        })),
      },
    },
    include: { sets: { include: { exercise: true } } },
  });

  return NextResponse.json({ log });
}

export async function DELETE(req: NextRequest) {
  const prisma = await getPrisma();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.workoutLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
