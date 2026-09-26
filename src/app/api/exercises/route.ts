import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  const params = req.nextUrl.searchParams;
  const q = params.get("q");
  const category = params.get("category");
  const equipment = params.get("equipment");
  const level = params.get("level");
  const muscle = params.get("muscle");
  const take = Number(params.get("take") ?? 60);

  const where: Prisma.ExerciseWhereInput = {};
  if (q) where.name = { contains: q };
  if (category) where.category = category;
  if (equipment) where.equipment = equipment;
  if (level) where.level = level;
  if (muscle) where.primaryMuscles = { contains: muscle };

  const exercises = await prisma.exercise.findMany({
    where,
    take,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    exercises: exercises.map((e) => ({
      ...e,
      primaryMuscles: JSON.parse(e.primaryMuscles),
      secondaryMuscles: JSON.parse(e.secondaryMuscles),
    })),
  });
}
