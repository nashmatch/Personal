import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { MUSCLE_GROUPS } from "@/lib/muscles";

export async function GET() {
  const prisma = await getPrisma();
  const [categories, equipment] = await Promise.all([
    prisma.exercise.findMany({ distinct: ["category"], select: { category: true } }),
    prisma.exercise.findMany({
      distinct: ["equipment"],
      select: { equipment: true },
      where: { equipment: { not: null } },
    }),
  ]);

  return NextResponse.json({
    categories: categories.map((c) => c.category).sort(),
    equipment: equipment.map((e) => e.equipment).sort(),
    muscles: MUSCLE_GROUPS,
  });
}
