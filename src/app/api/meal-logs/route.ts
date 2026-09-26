import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { dayRange, todayKey } from "@/lib/date";

export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  const user = await getCurrentUser();
  const date = req.nextUrl.searchParams.get("date") ?? todayKey();
  const logs = await prisma.mealLog.findMany({
    where: { userId: user.id, date: dayRange(date) },
    include: { food: true, recipe: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  const user = await getCurrentUser();
  const body = await req.json();
  const { date, mealType, foodId, recipeId, servings = 1 } = body;

  let calories = 0,
    proteinG = 0,
    carbsG = 0,
    fatG = 0;

  if (foodId) {
    const food = await prisma.food.findUnique({ where: { id: foodId } });
    if (!food) return NextResponse.json({ error: "Food not found" }, { status: 404 });
    calories = food.calories * servings;
    proteinG = food.proteinG * servings;
    carbsG = food.carbsG * servings;
    fatG = food.fatG * servings;
  } else if (recipeId) {
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    calories = recipe.caloriesPerServing * servings;
    proteinG = recipe.proteinG * servings;
    carbsG = recipe.carbsG * servings;
    fatG = recipe.fatG * servings;
  } else {
    return NextResponse.json({ error: "foodId or recipeId required" }, { status: 400 });
  }

  const log = await prisma.mealLog.create({
    data: {
      userId: user.id,
      date: new Date(date ?? new Date()),
      mealType,
      foodId: foodId ?? undefined,
      recipeId: recipeId ?? undefined,
      servings,
      calories,
      proteinG,
      carbsG,
      fatG,
    },
    include: { food: true, recipe: true },
  });

  return NextResponse.json({ log });
}

export async function DELETE(req: NextRequest) {
  const prisma = await getPrisma();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.mealLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
