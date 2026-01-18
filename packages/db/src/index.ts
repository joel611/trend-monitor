// Export schema and types
export * from "./schema";

// Export client factory and type
export { createDbClient, type DbClient } from "./client";

// Note: Runtime DB binding should be created in each worker
// because it depends on that worker's specific Cloudflare environment
// Note: Mock DB is exported separately via "@trend-monitor/db/mock" to avoid bundling in production
