import { drizzle } from "drizzle-orm/bun-sqlite";
import path from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import type { DbClient } from "./client";

export const createMockDB = (): DbClient => {
	const sqlite = new Database(":memory:");

	const db = drizzle({ client: sqlite, schema });

	// run migration
	migrate(db, {
		migrationsFolder: path.join(__dirname, "../migrations"),
	});

	return db as unknown as DbClient;
};
