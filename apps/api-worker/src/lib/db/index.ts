import { env } from "cloudflare:workers";
import { createDbClient } from "./client";

// In tests, env.DB is already a Drizzle client from mock-db.ts
// In production, env.DB is a D1Database that needs wrapping
// Check if it has the Drizzle query builder methods to determine which it is
const isAlreadyDrizzleClient = env.DB && typeof (env.DB as any).select === "function";

export const db = isAlreadyDrizzleClient ? (env.DB as any) : createDbClient(env.DB);
export { createDbClient } from "./client";
export type { DbClient } from "./client";
export * from "./schema";
