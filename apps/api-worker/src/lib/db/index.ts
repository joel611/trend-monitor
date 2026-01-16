import { env } from "cloudflare:workers";
import { createDbClient } from "./client";

export const db = createDbClient(env.DB);
export { createDbClient } from "./client";
export type { DbClient } from "./client";
export * from "./schema";
