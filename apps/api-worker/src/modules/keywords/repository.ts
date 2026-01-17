import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DbClient } from "../../lib/db/client";
import { keywords, type Keyword, type InsertKeyword } from "../../lib/db/schema";

export class KeywordsRepository {
  constructor(private db: DbClient) {}

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

    const newKeyword: InsertKeyword = {
      id,
      name: input.name.trim(),
      aliases: input.aliases,
      tags: input.tags,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.db.insert(keywords).values(newKeyword);
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
      const result = await this.db
        .select()
        .from(keywords)
        .where(eq(keywords.id, id))
        .limit(1);

      return result[0] || null;
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
        .select()
        .from(keywords)
        .orderBy(desc(keywords.createdAt))
        .limit(limit)
        .offset(offset);

      return result;
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

    const updates: Partial<Keyword> = {};

    if (input.name !== undefined) {
      updates.name = input.name.trim();
    }
    if (input.aliases !== undefined) {
      updates.aliases = input.aliases;
    }
    if (input.tags !== undefined) {
      updates.tags = input.tags;
    }
    if (input.status !== undefined) {
      updates.status = input.status;
    }

    if (Object.keys(updates).length === 0) return existing;

    updates.updatedAt = new Date().toISOString();

    try {
      await this.db
        .update(keywords)
        .set(updates)
        .where(eq(keywords.id, id));
    } catch (err) {
      throw new Error(
        `Failed to update keyword: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.db
        .update(keywords)
        .set({
          status: "archived",
          updatedAt: new Date().toISOString()
        })
        .where(eq(keywords.id, id));

      return true;
    } catch (err) {
      throw new Error(
        `Failed to delete keyword: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }
}
