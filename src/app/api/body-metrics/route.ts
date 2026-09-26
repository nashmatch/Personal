import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  const user = await getCurrentUser();
  const take = Number(req.nextUrl.searchParams.get("take") ?? 90);
  const metrics = await prisma.bodyMetric.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take,
  });
  return NextResponse.json({ metrics: metrics.reverse() });
}

export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  const user = await getCurrentUser();
  const body = await req.json();
  const { date, weightKg, bodyFatPct, notes } = body;

  const metric = await prisma.bodyMetric.create({
    data: {
      userId: user.id,
      date: new Date(date ?? new Date()),
      weightKg: weightKg ?? undefined,
      bodyFatPct: bodyFatPct ?? undefined,
      notes: notes ?? undefined,
    },
  });

  return NextResponse.json({ metric });
}

export async function DELETE(req: NextRequest) {
  const prisma = await getPrisma();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.bodyMetric.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
