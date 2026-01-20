# Feed Ingestion Worker - Deployment Guide

## Prerequisites

- Cloudflare account with Workers enabled
- D1 database created
- KV namespace for checkpoints
- Queue configured (`ingestion-queue`)

## Step 1: Database Setup

Apply migration:

```bash
cd apps/api-worker
wrangler d1 execute trend-monitor-production --file migrations/0002_add_source_configs.sql
```

## Step 2: Configure Feeds

Add feed sources to monitor:

```bash
wrangler d1 execute trend-monitor-production --command "
INSERT INTO source_configs (id, type, config, enabled) VALUES
  ('feed-reddit-programming', 'feed', '{\"url\":\"https://www.reddit.com/r/programming/.rss\",\"name\":\"Reddit r/programming\"}', 1),
  ('feed-reddit-webdev', 'feed', '{\"url\":\"https://www.reddit.com/r/webdev/.rss\",\"name\":\"Reddit r/webdev\"}', 1),
  ('feed-hackernews', 'feed', '{\"url\":\"https://news.ycombinator.com/rss\",\"name\":\"Hacker News\"}', 1),
  ('feed-x-trq212', 'feed', '{\"url\":\"https://rss.xcancel.com/trq212/rss\",\"name\":\"X @trq212\"}', 1),
  ('feed-cloudflare-blog', 'feed', '{\"url\":\"https://blog.cloudflare.com/rss/\",\"name\":\"Cloudflare Blog\"}', 1)
"
```

## Step 3: Deploy Worker

```bash
cd apps/ingestion-feeds
bun run deploy
```

## Step 4: Verify Deployment

```bash
wrangler deployments list
wrangler tail
```

## Step 5: Monitor Queue

```bash
wrangler queues consumer list ingestion-queue
```

## Recommended Feed Sources

### Tech News
- Hacker News: `https://news.ycombinator.com/rss`
- TechCrunch: `https://techcrunch.com/feed/`
- Ars Technica: `https://feeds.arstechnica.com/arstechnica/index`

### X/Twitter Accounts (via xcancel.com)
- @trq212: `https://rss.xcancel.com/trq212/rss`
- Any account: `https://rss.xcancel.com/{username}/rss`

### Reddit (Popular Tech Subreddits)
- r/programming: `https://www.reddit.com/r/programming/.rss`
- r/webdev: `https://www.reddit.com/r/webdev/.rss`
- r/javascript: `https://www.reddit.com/r/javascript/.rss`
- r/CloudFlare: `https://www.reddit.com/r/CloudFlare/.rss`

### Company Blogs
- Cloudflare: `https://blog.cloudflare.com/rss/`
- Vercel: `https://vercel.com/blog/feed`
- GitHub: `https://github.blog/feed/`

## Troubleshooting

**Worker not triggering:**
- Check cron: `wrangler deployments list`
- Verify schedule in wrangler.toml

**No events in queue:**
- Check logs: `wrangler tail`
- Test feed manually: `curl https://example.com/feed.xml`
- Verify feeds are valid XML

**Feed blocked:**
- Try custom User-Agent in config
- Some sites require specific user agents
