interface Env {
	DB: D1Database;
	CACHE: KVNamespace;
}

export default {
	async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
		console.log("Running aggregation at:", new Date().toISOString());
		// Aggregation logic will be added
	},
};
