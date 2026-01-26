# Feed Ingestion Worker

Universal RSS/Atom feed ingestion worker for monitoring Reddit, X/Twitter, Hacker News, blogs, and any feed source.

## Features

- ✅ **No authentication required** - Works with any public RSS/Atom feed
- ✅ **Multi-source support** - Reddit, X/Twitter, Hacker News, blogs, news sites
- ✅ **RSS 2.0 and Atom 1.0** - Handles both feed formats automatically
- ✅ **Incremental fetching** - KV-based checkpoints track last processed post
- ✅ **HTML to plain text** - Automatically converts feed content
- ✅ **Custom user agents** - Per-feed user agent configuration

## Supported Sources

### Reddit Subreddits
```sql
INSERT INTO source_configs (id, type, config, enabled) VALUES
('feed-reddit-programming', 'feed', '{
  "url": "https://www.reddit.com/r/programming/.rss",
  "name": "Reddit r/programming"
}', 1);
```

### Hacker News
```sql
INSERT INTO source_configs (id, type, config, enabled) VALUES
('feed-hackernews', 'feed', '{
  "url": "https://news.ycombinator.com/rss",
  "name": "Hacker News"
}', 1);
```

### X/Twitter Accounts
```sql
INSERT INTO source_configs (id, type, config, enabled) VALUES
('feed-x-trq212', 'feed', '{
  "url": "https://rss.xcancel.com/trq212/rss",
  "name": "X @trq212"
}', 1);
```

### Blogs/Websites
```sql
INSERT INTO source_configs (id, type, config, enabled) VALUES
('feed-cloudflare-blog', 'feed', '{
  "url": "https://blog.cloudflare.com/rss/",
  "name": "Cloudflare Blog"
}', 1);
```

### Custom User Agent (if needed)
```sql
INSERT INTO source_configs (id, type, config, enabled) VALUES
('feed-custom', 'feed', '{
  "url": "https://example.com/feed.xml",
  "name": "Custom Feed",
  "customUserAgent": "my-bot/1.0"
}', 1);
```

## Setup

### Local Development

```bash
bun run dev
```

### Testing

```bash
bun test
```

### Deployment

```bash
bun run deploy
```

## How It Works

1. **Cron triggers** worker every 15 minutes (or manual HTTP trigger)
2. **Loads active configs** from D1 `source_configs` table
3. **For each feed:**
   - Fetches RSS/Atom XML
   - Parses with automatic format detection
   - Loads checkpoint (last processed post timestamp)
   - Filters posts newer than checkpoint
   - Transforms to `IngestionEvent` format
   - Updates checkpoint
4. **Publishes events** to ingestion queue in batch

## HTTP Endpoints

In addition to scheduled execution, feeds can be triggered manually via HTTP endpoints:

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok"
}
```

### Trigger All Sources

Manually trigger ingestion for all enabled feed sources.

```bash
POST /trigger/all
```

Response:
```json
{
  "success": true,
  "summary": {
    "totalSources": 5,
    "successfulSources": 4,
    "failedSources": 1,
    "totalEvents": 42,
    "durationMs": 3456
  },
  "results": [
    {
      "sourceId": "abc123",
      "sourceName": "Hacker News",
      "status": "success",
      "eventsCount": 15,
      "checkpoint": "2026-01-23T10:30:00Z"
    },
    {
      "sourceId": "def456",
      "sourceName": "Reddit r/programming",
      "status": "failed",
      "eventsCount": 0,
      "error": "Feed fetch timeout"
    }
  ]
}
```

### Trigger Single Source

Manually trigger ingestion for a specific feed source by ID.

```bash
POST /trigger/:id
```

Success Response:
```json
{
  "success": true,
  "sourceId": "abc123",
  "sourceName": "Hacker News",
  "eventsCount": 15,
  "checkpoint": "2026-01-23T10:30:00Z",
  "durationMs": 1234
}
```

Error Response:
```json
{
  "success": false,
  "sourceId": "unknown",
  "sourceName": "Unknown",
  "error": "Source not found",
  "durationMs": 45
}
```

### Usage Examples

```bash
# Local development
curl -X POST http://localhost:8792/trigger/all
curl -X POST http://localhost:8792/trigger/feed-hackernews

# Production (replace with your worker URL)
curl -X POST https://ingestion-feeds.your-domain.workers.dev/trigger/all
```

## Monitoring

View worker logs:

```bash
wrangler tail
```

Check queue:

```bash
wrangler queues consumer list ingestion-queue
```

## Troubleshooting

**No events published**
- Check configs: `SELECT * FROM source_configs WHERE type = 'feed' AND enabled = 1`
- Verify feed URLs are accessible
- Check worker logs for errors

**Feed fetch errors**
- Some sites block automated requests
- Try custom User-Agent in config
- Verify feed URL returns valid XML

**Parsing errors**
- Worker supports RSS 2.0 and Atom 1.0
- Check feed format: `curl https://example.com/feed.xml`
- Report unsupported formats as issues

## Recommended Feeds

**Tech News:**
- Hacker News: `https://news.ycombinator.com/rss`
- TechCrunch: `https://techcrunch.com/feed/`
- The Verge: `https://www.theverge.com/rss/index.xml`

**X/Twitter Accounts (via xcancel.com):**
- @trq212: `https://rss.xcancel.com/trq212/rss`
- Any account: `https://rss.xcancel.com/{username}/rss`

**Subreddits:**
- r/programming: `https://www.reddit.com/r/programming/.rss`
- r/webdev: `https://www.reddit.com/r/webdev/.rss`
- r/CloudFlare: `https://www.reddit.com/r/CloudFlare/.rss`

**Blogs:**
- Cloudflare: `https://blog.cloudflare.com/rss/`
- Vercel: `https://vercel.com/blog/feed`
