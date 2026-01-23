import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import type { IngestionEvent } from "@trend-monitor/types";
import { handleScheduled } from "./handlers/scheduled-handler";
import { triggerRoutes } from "./routes/trigger";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	DB: D1Database;
	CHECKPOINT: KVNamespace;
	FEED_USER_AGENT: string;
}

const app = new Elysia({ adapter: CloudflareAdapter })
	.get("/health", () => ({ status: "ok" }))
	.use(triggerRoutes)
	.compile();

export default {
	fetch: app.fetch,
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		return handleScheduled(event, env, ctx);
	},
};

export type App = typeof app;
