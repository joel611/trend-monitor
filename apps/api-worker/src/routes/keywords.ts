import { Elysia, t } from 'elysia';
import type { D1Database } from '@cloudflare/workers-types';
import { KeywordsRepository } from '../db/keywords-repository';
import type { KeywordResponse, ListKeywordsResponse } from '@trend-monitor/types';

export const keywordsRoutes = (db: D1Database) =>
  new Elysia({ prefix: '/api/keywords' })
    .get(
      '/',
      async ({ query }): Promise<ListKeywordsResponse> => {
        const repo = new KeywordsRepository(db);
        let keywords = await repo.list();
        
        // Filter by status if provided
        if (query.status) {
          keywords = keywords.filter(k => k.status === query.status);
        }
        
        // Filter by tag if provided
        if (query.tag) {
          keywords = keywords.filter(k => k.tags.includes(query.tag));
        }
        
        return {
          keywords: keywords,
          total: keywords.length
        };
      },
      {
        query: t.Object({
          status: t.Optional(t.Union([t.Literal('active'), t.Literal('archived')])),
          tag: t.Optional(t.String())
        })
      }
    )
    .get(
      '/:id',
      async ({ params, set }): Promise<KeywordResponse | { message: string }> => {
        const repo = new KeywordsRepository(db);
        const keyword = await repo.findById(params.id);
        
        if (!keyword) {
          set.status = 404;
          return { message: 'Keyword not found' };
        }
        
        return keyword;
      },
      {
        params: t.Object({
          id: t.String()
        })
      }
    )
    .post(
      '/',
      async ({ body, set }): Promise<KeywordResponse> => {
        const repo = new KeywordsRepository(db);
        const keyword = await repo.create({
          name: body.name,
          aliases: body.aliases || [],
          tags: body.tags || []
        });
        set.status = 201;
        return keyword;
      },
      {
        body: t.Object({
          name: t.String({ minLength: 1 }),
          aliases: t.Optional(t.Array(t.String())),
          tags: t.Optional(t.Array(t.String()))
        })
      }
    )
    .put(
      '/:id',
      async ({ params, body, set }): Promise<KeywordResponse | { message: string }> => {
        const repo = new KeywordsRepository(db);
        const keyword = await repo.update(params.id, body);
        
        if (!keyword) {
          set.status = 404;
          return { message: 'Keyword not found' };
        }
        
        return keyword;
      },
      {
        params: t.Object({
          id: t.String()
        }),
        body: t.Object({
          name: t.Optional(t.String({ minLength: 1 })),
          aliases: t.Optional(t.Array(t.String())),
          tags: t.Optional(t.Array(t.String())),
          status: t.Optional(t.Union([t.Literal('active'), t.Literal('archived')]))
        })
      }
    )
    .delete(
      '/:id',
      async ({ params, set }) => {
        const repo = new KeywordsRepository(db);
        const keyword = await repo.update(params.id, { status: 'archived' });
        
        if (!keyword) {
          set.status = 404;
          return { message: 'Keyword not found' };
        }
        
        set.status = 204;
        return null;
      },
      {
        params: t.Object({
          id: t.String()
        })
      }
    );
