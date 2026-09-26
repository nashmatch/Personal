// Explicitly import the wasm-engine build via `require` (its "import"/ESM
// condition points at a .mjs file this Prisma version doesn't actually ship,
// but the CJS "require" condition resolves fine). OpenNext's build resolves
// `@prisma/client`'s conditional package exports using Node.js conditions
// (not "workerd"), so a plain `import ... from "@prisma/client"` would
// otherwise resolve to the native-binary engine, which doesn't exist in the
// Workers runtime.
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client/wasm") as { PrismaClient: typeof PrismaClientType };

// Cloudflare Workers are stateless per-isolate but an isolate can be reused
// across requests, so caching the client on globalThis avoids reconstructing
// it (and its D1 adapter) on every call within the same isolate.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

/**
 * Returns a PrismaClient bound to this Worker's D1 database. Must be called
 * from within a request (API route, server action) so the Cloudflare context
 * — and its `env.DB` binding — is available.
 */
export async function getPrisma(): Promise<PrismaClientType> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as { DB: D1Database }).DB;
  const adapter = new PrismaD1(db);
  const client = new PrismaClient({ adapter });

  globalForPrisma.prisma = client;
  return client;
}
