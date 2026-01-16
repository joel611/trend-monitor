import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from 'bun:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import { MentionsRepository } from './mentions-repository';
import type { Mention } from '@trend-monitor/types';

// Helper to create test database
const createTestDB = (): D1Database => {
  const db = new Database(':memory:');
  
  db.exec(`
    CREATE TABLE mentions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL UNIQUE,
      title TEXT,
      content TEXT,
      url TEXT,
      author TEXT,
      created_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      matched_keywords TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX idx_mentions_created_at ON mentions(created_at);
    CREATE INDEX idx_mentions_source ON mentions(source);
  `);
  
  return {
    prepare: (query: string) => {
      const stmt = db.prepare(query);
      return {
        bind: (...args: any[]) => ({
          all: async () => {
            const result = stmt.all(...args);
            return { results: Array.isArray(result) ? result : [result], success: true };
          },
          first: async () => {
            const result = stmt.get(...args);
            return result === undefined ? null : result;
          },
          run: async () => {
            const result = stmt.run(...args);
            return { success: true, meta: { changes: result.changes } };
          }
        }),
        all: async () => {
          const result = stmt.all();
          return { results: Array.isArray(result) ? result : [result], success: true };
        },
        first: async () => {
          const result = stmt.get();
          return result === undefined ? null : result;
        },
        run: async () => {
          const result = stmt.run();
          return { success: true, meta: { changes: result.changes } };
        }
      };
    }
  } as any;
};

describe('MentionsRepository', () => {
  let db: D1Database;
  let repo: MentionsRepository;

  beforeEach(() => {
    db = createTestDB();
    repo = new MentionsRepository(db);
  });

  describe('create', () => {
    it('should create a new mention', async () => {
      const input = {
        source: 'reddit' as const,
        sourceId: 'post_123',
        content: 'Check out this amazing React library!',
        url: 'https://reddit.com/r/reactjs/post_123',
        author: 'user123',
        createdAt: '2026-01-15T12:00:00Z',
        matchedKeywords: ['react']
      };

      const mention = await repo.create(input);

      expect(mention).toMatchObject({
        source: 'reddit',
        sourceId: 'post_123',
        content: 'Check out this amazing React library!',
        matchedKeywords: ['react']
      });
      expect(mention.id).toBeDefined();
      expect(mention.fetchedAt).toBeDefined();
    });

    it('should handle duplicate source_id', async () => {
      const input = {
        source: 'reddit' as const,
        sourceId: 'post_123',
        content: 'Content',
        url: 'https://example.com',
        createdAt: '2026-01-15T12:00:00Z',
        matchedKeywords: ['react']
      };

      await repo.create(input);
      
      await expect(repo.create(input)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should return mention by id', async () => {
      const input = {
        source: 'reddit' as const,
        sourceId: 'post_123',
        content: 'Content',
        url: 'https://example.com',
        createdAt: '2026-01-15T12:00:00Z',
        matchedKeywords: ['react']
      };

      const created = await repo.create(input);
      const found = await repo.findById(created.id);

      expect(found).toEqual(created);
    });

    it('should return null for non-existent id', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findByTimeRange', () => {
    beforeEach(async () => {
      await repo.create({
        source: 'reddit',
        sourceId: 'post_1',
        content: 'Old post',
        url: 'https://example.com/1',
        createdAt: '2026-01-10T12:00:00Z',
        matchedKeywords: ['react']
      });
      
      await repo.create({
        source: 'x',
        sourceId: 'tweet_2',
        content: 'Recent tweet',
        url: 'https://example.com/2',
        createdAt: '2026-01-15T12:00:00Z',
        matchedKeywords: ['vue']
      });
      
      await repo.create({
        source: 'reddit',
        sourceId: 'post_3',
        content: 'Another old post',
        url: 'https://example.com/3',
        createdAt: '2026-01-11T12:00:00Z',
        matchedKeywords: ['react']
      });
    });

    it('should return mentions within time range', async () => {
      const mentions = await repo.findByTimeRange(
        '2026-01-14T00:00:00Z',
        '2026-01-16T00:00:00Z'
      );

      expect(mentions).toHaveLength(1);
      expect(mentions[0].content).toBe('Recent tweet');
    });

    it('should filter by source', async () => {
      const mentions = await repo.findByTimeRange(
        '2026-01-01T00:00:00Z',
        '2026-01-20T00:00:00Z',
        { source: 'reddit' }
      );

      expect(mentions).toHaveLength(2);
      expect(mentions.every(m => m.source === 'reddit')).toBe(true);
    });

    it('should filter by keyword', async () => {
      const mentions = await repo.findByTimeRange(
        '2026-01-01T00:00:00Z',
        '2026-01-20T00:00:00Z',
        { keyword: 'react' }
      );

      expect(mentions).toHaveLength(2);
      expect(mentions.every(m => m.matchedKeywords.includes('react'))).toBe(true);
    });

    it('should apply limit and offset', async () => {
      const page1 = await repo.findByTimeRange(
        '2026-01-01T00:00:00Z',
        '2026-01-20T00:00:00Z',
        { limit: 2 }
      );

      expect(page1).toHaveLength(2);

      const page2 = await repo.findByTimeRange(
        '2026-01-01T00:00:00Z',
        '2026-01-20T00:00:00Z',
        { limit: 2, offset: 2 }
      );

      expect(page2).toHaveLength(1);
    });

    it('should order by created_at DESC', async () => {
      const mentions = await repo.findByTimeRange(
        '2026-01-01T00:00:00Z',
        '2026-01-20T00:00:00Z'
      );

      expect(mentions[0].createdAt).toBe('2026-01-15T12:00:00Z');
      expect(mentions[1].createdAt).toBe('2026-01-11T12:00:00Z');
      expect(mentions[2].createdAt).toBe('2026-01-10T12:00:00Z');
    });
  });
});
