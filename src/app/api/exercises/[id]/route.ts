import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    exercise: {
      ...exercise,
      primaryMuscles: JSON.parse(exercise.primaryMuscles),
      secondaryMuscles: JSON.parse(exercise.secondaryMuscles),
      instructions: exercise.instructions.split("\n"),
    },
  });
}
