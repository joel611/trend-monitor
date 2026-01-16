import { describe, it, expect, beforeEach } from 'vitest';
import { treaty } from '@elysiajs/eden';
import app from '../index';

const client = treaty(app);

describe('Keywords API', () => {
  beforeEach(async () => {
    // Clean up database
    const db = app.decorator.db;
    await db.prepare('DELETE FROM keywords').run();
  });

  describe('GET /api/keywords', () => {
    it('should return empty array when no keywords exist', async () => {
      const { data, error } = await client.api.keywords.get();
      
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('should return all keywords', async () => {
      const db = app.decorator.db;
      await db.prepare(
        `INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('kw1', 'React', '["ReactJS"]', '["frontend"]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z').run();

      const { data, error } = await client.api.keywords.get();
      
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0]).toMatchObject({
        id: 'kw1',
        name: 'React',
        aliases: ['ReactJS'],
        tags: ['frontend'],
        status: 'active'
      });
    });

    it('should filter by status', async () => {
      const db = app.decorator.db;
      await db.prepare(
        `INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('kw1', 'React', '[]', '[]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z').run();
      
      await db.prepare(
        `INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('kw2', 'Vue', '[]', '[]', 'archived', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z').run();

      const { data, error } = await client.api.keywords.get({ query: { status: 'active' } });
      
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe('kw1');
    });

    it('should filter by tag', async () => {
      const db = app.decorator.db;
      await db.prepare(
        `INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('kw1', 'React', '[]', '["frontend"]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z').run();
      
      await db.prepare(
        `INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('kw2', 'PostgreSQL', '[]', '["database"]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z').run();

      const { data, error } = await client.api.keywords.get({ query: { tag: 'frontend' } });
      
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe('kw1');
    });
  });

  describe('GET /api/keywords/:id', () => {
    it('should return 404 for non-existent keyword', async () => {
      const { data, error, status } = await client.api.keywords({ id: 'nonexistent' }).get();
      
      expect(status).toBe(404);
      expect(error).toBeDefined();
    });

    it('should return keyword by id', async () => {
      const db = app.decorator.db;
      await db.prepare(
        `INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('kw1', 'React', '["ReactJS"]', '["frontend"]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z').run();

      const { data, error } = await client.api.keywords({ id: 'kw1' }).get();
      
      expect(error).toBeNull();
      expect(data).toMatchObject({
        id: 'kw1',
        name: 'React',
        aliases: ['ReactJS'],
        tags: ['frontend'],
        status: 'active'
      });
    });
  });

  describe('POST /api/keywords', () => {
    it('should create a new keyword', async () => {
      const input = {
        name: 'TypeScript',
        aliases: ['TS'],
        tags: ['frontend', 'language']
      };

      const { data, error, status } = await client.api.keywords.post(input);
      
      expect(error).toBeNull();
      expect(status).toBe(201);
      expect(data).toMatchObject({
        name: 'TypeScript',
        aliases: ['TS'],
        tags: ['frontend', 'language'],
        status: 'active'
      });
      expect(data!.id).toBeDefined();
    });

    it('should reject invalid input', async () => {
      const { status } = await client.api.keywords.post({ name: '' });
      
      expect(status).toBe(400);
    });
  });

  describe('PUT /api/keywords/:id', () => {
    it('should update existing keyword', async () => {
      const db = app.decorator.db;
      await db.prepare(
        `INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('kw1', 'React', '[]', '[]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z').run();

      const update = {
        aliases: ['ReactJS', 'React.js'],
        tags: ['frontend', 'library']
      };

      const { data, error } = await client.api.keywords({ id: 'kw1' }).put(update);
      
      expect(error).toBeNull();
      expect(data).toMatchObject({
        id: 'kw1',
        name: 'React',
        aliases: ['ReactJS', 'React.js'],
        tags: ['frontend', 'library']
      });
    });

    it('should return 404 for non-existent keyword', async () => {
      const { status } = await client.api.keywords({ id: 'nonexistent' }).put({ tags: ['test'] });
      
      expect(status).toBe(404);
    });
  });

  describe('PATCH /api/keywords/:id/status', () => {
    it('should update keyword status', async () => {
      const db = app.decorator.db;
      await db.prepare(
        `INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('kw1', 'React', '[]', '[]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z').run();

      const { data, error } = await client.api.keywords({ id: 'kw1' }).status.patch({ status: 'archived' });
      
      expect(error).toBeNull();
      expect(data).toMatchObject({
        id: 'kw1',
        status: 'archived'
      });
    });

    it('should reject invalid status', async () => {
      const db = app.decorator.db;
      await db.prepare(
        `INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('kw1', 'React', '[]', '[]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z').run();

      const { status } = await client.api.keywords({ id: 'kw1' }).status.patch({ status: 'invalid' });
      
      expect(status).toBe(400);
    });
  });
});
