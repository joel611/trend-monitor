import type { D1Database } from '@cloudflare/workers-types';
import type { Mention, MentionRow, Source } from '@trend-monitor/types';
import { randomUUID } from 'node:crypto';

export class MentionsRepository {
  constructor(private db: D1Database) {}

  async create(input: {
    source: Source;
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

    try {
      await this.db
        .prepare(
          `INSERT INTO mentions (id, source, source_id, title, content, url, author, created_at, fetched_at, matched_keywords)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          input.source,
          input.sourceId,
          input.title || null,
          input.content,
          input.url,
          input.author || null,
          input.createdAt,
          fetchedAt,
          JSON.stringify(input.matchedKeywords)
        )
        .run();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to create mention: ${message}`);
    }

    return {
      id,
      source: input.source,
      sourceId: input.sourceId,
      title: input.title,
      content: input.content,
      url: input.url,
      author: input.author,
      createdAt: input.createdAt,
      fetchedAt,
      matchedKeywords: input.matchedKeywords
    };
  }

  async findById(id: string): Promise<Mention | null> {
    try {
      const row = await this.db
        .prepare('SELECT * FROM mentions WHERE id = ?')
        .bind(id)
        .first<MentionRow>();

      return row ? this.rowToEntity(row) : null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to find mention: ${message}`);
    }
  }

  async findByTimeRange(
    startTime: string,
    endTime: string,
    options?: {
      source?: Source;
      keyword?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Mention[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let query = `
      SELECT * FROM mentions
      WHERE created_at >= ? AND created_at <= ?
    `;
    const params: any[] = [startTime, endTime];

    if (options?.source) {
      query += ' AND source = ?';
      params.push(options.source);
    }

    if (options?.keyword) {
      query += ' AND matched_keywords LIKE ?';
      params.push(`%"${options.keyword}"%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
      const result = await this.db
        .prepare(query)
        .bind(...params)
        .all<MentionRow>();

      return result.results.map(row => this.rowToEntity(row));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to find mentions: ${message}`);
    }
  }

  private rowToEntity(row: MentionRow): Mention {
    let matchedKeywords: string[] = [];

    try {
      matchedKeywords = JSON.parse(row.matched_keywords);
    } catch (e) {
      console.error('Failed to parse matched_keywords JSON in mention row:', row.id, e);
      matchedKeywords = [];
    }

    return {
      id: row.id,
      source: row.source as Source,
      sourceId: row.source_id,
      title: row.title || undefined,
      content: row.content,
      url: row.url,
      author: row.author || undefined,
      createdAt: row.created_at,
      fetchedAt: row.fetched_at,
      matchedKeywords
    };
  }
}
