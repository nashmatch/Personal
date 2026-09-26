import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export async function GET() {
  const user = await getCurrentUser();
  const templates = await prisma.workoutTemplate.findMany({
    where: { userId: user.id },
    include: { exercises: { include: { exercise: true }, orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = await req.json();
  const { name, notes, exercises } = body;

  const template = await prisma.workoutTemplate.create({
    data: {
      userId: user.id,
      name,
      notes: notes ?? undefined,
      exercises: {
        create: exercises.map(
          (
            e: { exerciseId: string; order?: number; targetSets?: number; targetReps?: number; targetWeightKg?: number; restSeconds?: number },
            idx: number,
          ) => ({
          exerciseId: e.exerciseId,
          order: e.order ?? idx,
          targetSets: e.targetSets ?? 3,
          targetReps: e.targetReps ?? 10,
          targetWeightKg: e.targetWeightKg ?? undefined,
          restSeconds: e.restSeconds ?? 90,
        })),
      },
    },
    include: { exercises: { include: { exercise: true } } },
  });

  return NextResponse.json({ template });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.workoutTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
