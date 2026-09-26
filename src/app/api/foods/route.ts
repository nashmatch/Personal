import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Create (or reuse) a Food row — used both for custom foods and to persist
// a food picked from the live USDA search before logging it.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    fdcId,
    name,
    brand,
    servingQty = 1,
    servingUnit = "serving",
    gramsPerServing = 100,
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    sugarG,
    sodiumMg,
    source = "CUSTOM",
  } = body;

  if (!name || calories == null || proteinG == null || carbsG == null || fatG == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (fdcId) {
    const existing = await prisma.food.findUnique({ where: { fdcId } });
    if (existing) return NextResponse.json({ food: existing });
  }

  const food = await prisma.food.create({
    data: {
      fdcId: fdcId ?? undefined,
      name,
      brand: brand ?? undefined,
      source,
      servingQty,
      servingUnit,
      gramsPerServing,
      calories,
      proteinG,
      carbsG,
      fatG,
      fiberG: fiberG ?? undefined,
      sugarG: sugarG ?? undefined,
      sodiumMg: sodiumMg ?? undefined,
    },
  });

  return NextResponse.json({ food });
}
