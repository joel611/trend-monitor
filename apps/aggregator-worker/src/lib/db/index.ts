import { env } from "cloudflare:workers";
import { createDbClient } from "@trend-monitor/db";

// In tests, env.DB is already a Drizzle client from mock
// In production, env.DB is a D1Database that needs wrapping
// Check if it has the Drizzle query builder methods to determine which it is
// @ts-expect-error - DB is added to env at runtime by Cloudflare Workers or test mocks
// biome-ignore lint/suspicious/noExplicitAny: Runtime type detection requires any
const isAlreadyDrizzleClient = env.DB && typeof (env.DB as any).select === "function";

// @ts-expect-error - DB is added to env at runtime by Cloudflare Workers or test mocks
// biome-ignore lint/suspicious/noExplicitAny: Runtime type detection requires any
export const db = isAlreadyDrizzleClient ? (env.DB as any) : createDbClient(env.DB);

// Re-export everything from shared db package for convenience
export * from "@trend-monitor/db";
