import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

const app = new Elysia({ adapter: CloudflareAdapter })
	.get("/api/health", () => ({ status: "ok" }))
	.get("/api/keywords", () => ({ keywords: [] }))
	.get("/api/trends/overview", () => ({ trends: [] }))
	.get("/api/mentions", () => ({ mentions: [] }))
	.compile();

export default app;
