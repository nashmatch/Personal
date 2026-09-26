import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export async function GET() {
  const user = await getCurrentUser();
  const plans = await prisma.mealPlan.findMany({
    where: { userId: user.id },
    include: { entries: { include: { recipe: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = await req.json();
  const { name, days, targetCalories, targetProtein, targetCarbs, targetFat, cuisineFilter, maxMinutes, meals } = body;

  const plan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      name: name || `Meal Plan — ${new Date().toLocaleDateString()}`,
      days,
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
      cuisineFilter: cuisineFilter ?? undefined,
      maxMinutes: maxMinutes ?? undefined,
      entries: {
        create: meals.map((m: { day: number; mealType: string; recipeId: string; servings: number }) => ({
          day: m.day,
          mealType: m.mealType,
          recipeId: m.recipeId,
          servings: m.servings,
        })),
      },
    },
    include: { entries: { include: { recipe: true } } },
  });

  return NextResponse.json({ plan });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.mealPlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
