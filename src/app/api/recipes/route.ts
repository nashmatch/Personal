import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  const params = req.nextUrl.searchParams;
  const cuisine = params.get("cuisine");
  const maxMinutes = params.get("maxMinutes");
  const tag = params.get("tag");
  const q = params.get("q");
  const ingredients = params.get("ingredients"); // comma separated

  const where: Prisma.RecipeWhereInput = {};
  if (cuisine) where.cuisine = cuisine;
  if (maxMinutes) where.totalMinutes = { lte: Number(maxMinutes) };
  if (q) where.name = { contains: q };

  let recipes = await prisma.recipe.findMany({
    where,
    include: { ingredients: true },
    orderBy: { name: "asc" },
  });

  if (tag) {
    recipes = recipes.filter((r) => (JSON.parse(r.tagsJson) as string[]).includes(tag));
  }

  if (ingredients) {
    const wanted = ingredients
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (wanted.length) {
      recipes = recipes.filter((r) => {
        const names = r.ingredients.map((i) => i.name.toLowerCase());
        return wanted.some((w) => names.some((n) => n.includes(w)));
      });
    }
  }

  return NextResponse.json({
    recipes: recipes.map((r) => ({ ...r, tags: JSON.parse(r.tagsJson) })),
  });
}
