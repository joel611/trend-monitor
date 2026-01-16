import type { D1Database } from "@cloudflare/workers-types";
import type { Keyword, KeywordRow } from "@trend-monitor/types";
import { randomUUID } from "node:crypto";

export class KeywordsRepository {
  constructor(private db: D1Database) {}

  async create(input: {
    name: string;
    aliases: string[];
    tags: string[];
  }): Promise<Keyword> {
    // Validate input
    if (!input.name?.trim()) {
      throw new Error("Keyword name cannot be empty");
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    try {
      await this.db
        .prepare(
          "INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          id,
          input.name.trim(),
          JSON.stringify(input.aliases),
          JSON.stringify(input.tags),
          "active",
          now,
          now
        )
        .run();
    } catch (err) {
      throw new Error(
        `Failed to create keyword: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    return {
      id,
      name: input.name.trim(),
      aliases: input.aliases,
      tags: input.tags,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
  }

  async findById(id: string): Promise<Keyword | null> {
    try {
      const row = await this.db
        .prepare("SELECT * FROM keywords WHERE id = ?")
        .bind(id)
        .first<KeywordRow>();

      return row ? this.rowToEntity(row) : null;
    } catch (err) {
      throw new Error(
        `Failed to find keyword: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  async list(options?: { limit?: number; offset?: number }): Promise<Keyword[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    // Validate pagination parameters
    if (limit < 1 || limit > 1000) {
      throw new Error("Limit must be between 1 and 1000");
    }
    if (offset < 0) {
      throw new Error("Offset must be non-negative");
    }

    try {
      const result = await this.db
        .prepare("SELECT * FROM keywords ORDER BY created_at DESC LIMIT ? OFFSET ?")
        .bind(limit, offset)
        .all<KeywordRow>();

      return result.results.map((row) => this.rowToEntity(row));
    } catch (err) {
      throw new Error(
        `Failed to list keywords: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  async update(
    id: string,
    input: {
      name?: string;
      aliases?: string[];
      tags?: string[];
      status?: "active" | "archived";
    }
  ): Promise<Keyword | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    // Validate name if provided
    if (input.name !== undefined && !input.name?.trim()) {
      throw new Error("Keyword name cannot be empty");
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      updates.push("name = ?");
      params.push(input.name.trim());
    }
    if (input.aliases !== undefined) {
      updates.push("aliases = ?");
      params.push(JSON.stringify(input.aliases));
    }
    if (input.tags !== undefined) {
      updates.push("tags = ?");
      params.push(JSON.stringify(input.tags));
    }
    if (input.status !== undefined) {
      updates.push("status = ?");
      params.push(input.status);
    }

    if (updates.length === 0) return existing;

    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    const query = "UPDATE keywords SET " + updates.join(", ") + " WHERE id = ?";

    try {
      await this.db
        .prepare(query)
        .bind(...params)
        .run();
    } catch (err) {
      throw new Error(
        `Failed to update keyword: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .prepare("UPDATE keywords SET status = 'archived', updated_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), id)
        .run();

      return result.success;
    } catch (err) {
      throw new Error(
        `Failed to delete keyword: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  private rowToEntity(row: KeywordRow): Keyword {
    let aliases: string[] = [];
    let tags: string[] = [];

    // Safe JSON parsing with fallbacks
    try {
      aliases = JSON.parse(row.aliases);
    } catch (e) {
      console.error("Failed to parse aliases JSON in keyword row:", row.id, e);
      aliases = [];
    }

    try {
      tags = JSON.parse(row.tags);
    } catch (e) {
      console.error("Failed to parse tags JSON in keyword row:", row.id, e);
      tags = [];
    }

    return {
      id: row.id,
      name: row.name,
      aliases,
      tags,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
