// scripts/migrate.ts
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

interface D1Database {
  exec(query: string): Promise<{ success: boolean }>;
}

export async function runMigrations(db: D1Database) {
  const migrationsDir = join(__dirname, "../migrations");
  const files = await readdir(migrationsDir);
  const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

  for (const file of sqlFiles) {
    const sql = await readFile(join(migrationsDir, file), "utf-8");
    const result = await db.exec(sql);
    if (!result.success) {
      throw new Error(`Migration ${file} failed`);
    }
    console.log(`Applied migration: ${file}`);
  }
}
