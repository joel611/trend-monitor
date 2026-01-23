import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { cors } from "@elysiajs/cors";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { keywordsRoutes } from "./modules/keywords";
import { mentionsRoutes } from "./modules/mentions";
import { trendsRoutes } from "./modules/trends";
import { sourcesRoutes } from "./modules/sources";

const app = new Elysia({ adapter: CloudflareAdapter })
	.use(cors())
	.use(openapi())
	.group("/api", (app) =>
		app
			.get("/health", () => ({ status: "ok" }))
			.use(keywordsRoutes)
			.use(mentionsRoutes)
			.use(trendsRoutes)
			.use(sourcesRoutes),
	)
	.compile();

export default app;
export type App = typeof app;
