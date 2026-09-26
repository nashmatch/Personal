import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchFdcFoods } from "@/lib/fdc";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ local: [], remote: [] });

  const [local, remote] = await Promise.all([
    prisma.food.findMany({
      where: { name: { contains: q } },
      take: 20,
      orderBy: { name: "asc" },
    }),
    searchFdcFoods(q, 12),
  ]);

  return NextResponse.json({ local, remote });
}
