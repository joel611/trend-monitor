import { Elysia, t } from 'elysia';
import type { D1Database } from '@cloudflare/workers-types';
import { KeywordsRepository } from '../db/keywords-repository';

export const keywordsRoutes = (db: D1Database) =>
  new Elysia({ prefix: '/api/keywords' })
    .get(
      '/',
      async ({ query }) => {
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
        
        return keywords;
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
      async ({ params, set }) => {
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
      async ({ body, set }) => {
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
      async ({ params, body, set }) => {
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
          tags: t.Optional(t.Array(t.String()))
        })
      }
    )
    .patch(
      '/:id/status',
      async ({ params, body, set }) => {
        const repo = new KeywordsRepository(db);
        const keyword = await repo.update(params.id, { status: body.status });
        
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
          status: t.Union([t.Literal('active'), t.Literal('archived')])
        })
      }
    );
