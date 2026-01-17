import { eq, and, gte, lte, like, desc, count, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DbClient } from "../../lib/db/client";
import { mentions, type Mention, type InsertMention } from "../../lib/db/schema";

export interface MentionFilters {
  keywordId?: string;
  source?: "reddit" | "x" | "feed";
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

export interface MentionListResult {
  mentions: Mention[];
  total: number;
}

export class MentionsRepository {
  constructor(private db: DbClient) {}

  async create(input: {
    source: "reddit" | "x" | "feed";
    sourceId: string;
    title?: string;
    content: string;
    url: string;
    author?: string;
    createdAt: string;
    matchedKeywords: string[];
  }): Promise<Mention> {
    const id = randomUUID();
    const fetchedAt = new Date().toISOString();

    const newMention: InsertMention = {
      id,
      source: input.source,
      sourceId: input.sourceId,
      title: input.title || null,
      content: input.content,
      url: input.url,
      author: input.author || null,
      createdAt: input.createdAt,
      fetchedAt,
      matchedKeywords: input.matchedKeywords,
    };

    try {
      await this.db.insert(mentions).values(newMention);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Failed to create mention: ${message}`);
    }

    return {
      id,
      source: input.source,
      sourceId: input.sourceId,
      title: input.title || null,
      content: input.content,
      url: input.url,
      author: input.author || null,
      createdAt: input.createdAt,
      fetchedAt,
      matchedKeywords: input.matchedKeywords,
    };
  }

  async findById(id: string): Promise<Mention | null> {
    try {
      const result = await this.db
        .select()
        .from(mentions)
        .where(eq(mentions.id, id))
        .limit(1);

      return result[0] || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Failed to find mention: ${message}`);
    }
  }

  async list(filters: MentionFilters): Promise<MentionListResult> {
    const conditions = [];

    if (filters.keywordId) {
      // Use SQL LIKE for JSON array search (matched_keywords contains the keyword ID)
      conditions.push(like(mentions.matchedKeywords, `%"${filters.keywordId}"%`));
    }

    if (filters.source) {
      conditions.push(eq(mentions.source, filters.source));
    }

    if (filters.from) {
      conditions.push(gte(mentions.createdAt, filters.from));
    }

    if (filters.to) {
      conditions.push(lte(mentions.createdAt, filters.to));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    try {
      // Get total count
      const countResult = await this.db
        .select({ count: count() })
        .from(mentions)
        .where(whereClause);

      const total = countResult[0]?.count || 0;

      // Get paginated results
      const result = await this.db
        .select()
        .from(mentions)
        .where(whereClause)
        .orderBy(desc(mentions.createdAt))
        .limit(filters.limit)
        .offset(filters.offset);

      return {
        mentions: result,
        total,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Failed to list mentions: ${message}`);
    }
  }

  async findByTimeRange(
    startTime: string,
    endTime: string,
    options?: {
      source?: "reddit" | "x" | "feed";
      keyword?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Mention[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const conditions = [
      gte(mentions.createdAt, startTime),
      lte(mentions.createdAt, endTime),
    ];

    if (options?.source) {
      conditions.push(eq(mentions.source, options.source));
    }

    if (options?.keyword) {
      conditions.push(like(mentions.matchedKeywords, `%"${options.keyword}"%`));
    }

    try {
      const result = await this.db
        .select()
        .from(mentions)
        .where(and(...conditions))
        .orderBy(desc(mentions.createdAt))
        .limit(limit)
        .offset(offset);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Failed to find mentions: ${message}`);
    }
  }
}
