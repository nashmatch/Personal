import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export async function GET() {
  const user = await getCurrentUser();
  const goals = await prisma.goal.findMany({
    where: { userId: user.id },
    include: { exercise: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = await req.json();
  const {
    kind,
    name,
    targetCalories,
    targetProtein,
    targetCarbs,
    targetFat,
    targetWeightKg,
    startWeightKg,
    targetDate,
    exerciseId,
    targetWeightForLift,
    targetReps,
    targetPerWeek,
    notes,
  } = body;

  if (kind === "NUTRITION") {
    await prisma.goal.updateMany({
      where: { userId: user.id, kind: "NUTRITION", active: true },
      data: { active: false },
    });
  }

  const goal = await prisma.goal.create({
    data: {
      userId: user.id,
      kind,
      name,
      targetCalories: targetCalories ?? undefined,
      targetProtein: targetProtein ?? undefined,
      targetCarbs: targetCarbs ?? undefined,
      targetFat: targetFat ?? undefined,
      targetWeightKg: targetWeightKg ?? undefined,
      startWeightKg: startWeightKg ?? undefined,
      targetDate: targetDate ? new Date(targetDate) : undefined,
      exerciseId: exerciseId ?? undefined,
      targetWeightForLift: targetWeightForLift ?? undefined,
      targetReps: targetReps ?? undefined,
      targetPerWeek: targetPerWeek ?? undefined,
      notes: notes ?? undefined,
    },
  });

  return NextResponse.json({ goal });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const goal = await prisma.goal.update({ where: { id }, data: rest });
  return NextResponse.json({ goal });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.goal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
