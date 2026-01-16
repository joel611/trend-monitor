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
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        "INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        id,
        input.name,
        JSON.stringify(input.aliases),
        JSON.stringify(input.tags),
        "active",
        now,
        now
      )
      .run();

    return {
      id,
      name: input.name,
      aliases: input.aliases,
      tags: input.tags,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
  }

  async findById(id: string): Promise<Keyword | null> {
    const row = await this.db
      .prepare("SELECT * FROM keywords WHERE id = ?")
      .bind(id)
      .first<KeywordRow>();

    return row ? this.rowToEntity(row) : null;
  }

  async list(): Promise<Keyword[]> {
    const result = await this.db
      .prepare("SELECT * FROM keywords ORDER BY created_at DESC")
      .all<KeywordRow>();

    return result.results.map(this.rowToEntity);
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

    const updates: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      updates.push("name = ?");
      params.push(input.name);
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

    await this.db
      .prepare(query)
      .bind(...params)
      .run();

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .prepare("UPDATE keywords SET status = 'archived', updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), id)
      .run();

    return result.success;
  }

  private rowToEntity(row: KeywordRow): Keyword {
    return {
      id: row.id,
      name: row.name,
      aliases: JSON.parse(row.aliases),
      tags: JSON.parse(row.tags),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
