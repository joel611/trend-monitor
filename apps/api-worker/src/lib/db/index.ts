import { env } from "cloudflare:workers";
import { createDbClient } from "@trend-monitor/db";

// In tests, env.DB is already a Drizzle client from mock-db.ts
// In production, env.DB is a D1Database that needs wrapping
const isAlreadyDrizzleClient = env.DB && typeof (env.DB as any).select === "function";

export const db = isAlreadyDrizzleClient ? (env.DB as any) : createDbClient(env.DB);

// Re-export everything from shared package
export { createDbClient, type DbClient } from "@trend-monitor/db";
export * from "@trend-monitor/db";
