import { NextRequest, NextResponse } from "next/server";
import { generateMealPlan } from "@/lib/mealPlanner";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    targetCalories,
    targetProtein,
    targetCarbs,
    targetFat,
    days = 3,
    mealsPerDay = 3,
    cuisine,
    maxMinutes,
    tags,
    ingredients,
  } = body;

  if (!targetCalories || !targetProtein || !targetCarbs || !targetFat) {
    return NextResponse.json({ error: "Macro targets are required" }, { status: 400 });
  }

  const meals = await generateMealPlan({
    targetCalories,
    targetProtein,
    targetCarbs,
    targetFat,
    days: Math.min(Math.max(Number(days), 1), 7),
    mealsPerDay: mealsPerDay === 4 ? 4 : 3,
    cuisine,
    maxMinutes,
    tags,
    ingredients,
  });

  return NextResponse.json({ meals });
}
