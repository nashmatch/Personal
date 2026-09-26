import { prisma } from "@/lib/prisma";

let cachedUserId: string | null = null;

/** Single-user local app: fetches (or creates) the default profile. */
export async function getCurrentUser() {
  if (cachedUserId) {
    const existing = await prisma.user.findUnique({ where: { id: cachedUserId } });
    if (existing) return existing;
  }
  let user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    user = await prisma.user.create({
      data: { name: "You", email: "you@example.com" },
    });
  }
  cachedUserId = user.id;
  return user;
}
