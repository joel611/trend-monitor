# API Reference

Complete reference for the Trend Monitor API.

**Base URL**: `https://api.trend-monitor.example.com` (production)
**Local URL**: `http://localhost:8787` (development)

All endpoints are prefixed with `/api`.

## Authentication

Currently, the API is open for read operations. Authentication will be added in future versions.

## Response Format

All responses return JSON with appropriate HTTP status codes.

### Success Response
```json
{
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

## Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `204 No Content` - Request succeeded with no response body
- `400 Bad Request` - Validation error or malformed request
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Health Check

### GET /api/health

Check API health status.

**Response**
```json
{
  "status": "ok"
}
```

---

## Keywords API

Manage monitored keywords.

### List Keywords

**GET /api/keywords**

List all keywords with optional filtering.

**Query Parameters**
- `status` (optional) - Filter by status: `active` | `archived`
- `tag` (optional) - Filter by tag (exact match)

**Response**
```json
{
  "keywords": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "ElysiaJS",
      "aliases": ["elysia"],
      "tags": ["framework", "backend"],
      "status": "active",
      "createdAt": "2026-01-16T10:00:00Z",
      "updatedAt": "2026-01-16T10:00:00Z"
    }
  ],
  "total": 1
}
```

**Examples**

```bash
# Get all keywords
curl http://localhost:8787/api/keywords

# Get active keywords only
curl http://localhost:8787/api/keywords?status=active

# Get keywords with specific tag
curl http://localhost:8787/api/keywords?tag=frontend
```

---

### Create Keyword

**POST /api/keywords**

Create a new keyword.

**Request Body**
```json
{
  "name": "ElysiaJS",
  "aliases": ["elysia"],
  "tags": ["framework", "backend"]
}
```

**Fields**
- `name` (required) - Keyword name (min length: 1)
- `aliases` (optional) - Array of alias strings
- `tags` (optional) - Array of tag strings

**Response** (201 Created)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "ElysiaJS",
  "aliases": ["elysia"],
  "tags": ["framework", "backend"],
  "status": "active",
  "createdAt": "2026-01-16T10:00:00Z",
  "updatedAt": "2026-01-16T10:00:00Z"
}
```

**Examples**

```bash
curl -X POST http://localhost:8787/api/keywords \
  -H "Content-Type: application/json" \
  -d '{
    "name": "React",
    "aliases": ["ReactJS", "React.js"],
    "tags": ["frontend", "library"]
  }'
```

---

### Get Keyword

**GET /api/keywords/:id**

Get a specific keyword by ID.

**Path Parameters**
- `id` (required) - Keyword UUID

**Response**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "ElysiaJS",
  "aliases": ["elysia"],
  "tags": ["framework", "backend"],
  "status": "active",
  "createdAt": "2026-01-16T10:00:00Z",
  "updatedAt": "2026-01-16T10:00:00Z"
}
```

**Error Responses**
- `404` - Keyword not found

**Examples**

```bash
curl http://localhost:8787/api/keywords/550e8400-e29b-41d4-a716-446655440000
```

---

### Update Keyword

**PUT /api/keywords/:id**

Update an existing keyword. All fields are optional.

**Path Parameters**
- `id` (required) - Keyword UUID

**Request Body**
```json
{
  "name": "ElysiaJS Framework",
  "aliases": ["elysia", "elysiajs"],
  "tags": ["framework", "backend", "typescript"],
  "status": "active"
}
```

**Fields**
- `name` (optional) - New keyword name
- `aliases` (optional) - New aliases array
- `tags` (optional) - New tags array
- `status` (optional) - New status: `active` | `archived`

**Response**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "ElysiaJS Framework",
  "aliases": ["elysia", "elysiajs"],
  "tags": ["framework", "backend", "typescript"],
  "status": "active",
  "createdAt": "2026-01-16T10:00:00Z",
  "updatedAt": "2026-01-16T12:30:00Z"
}
```

**Error Responses**
- `404` - Keyword not found
- `400` - Validation error

**Examples**

```bash
# Update name only
curl -X PUT http://localhost:8787/api/keywords/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

# Archive keyword
curl -X PUT http://localhost:8787/api/keywords/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{"status": "archived"}'
```

---

### Delete Keyword

**DELETE /api/keywords/:id**

Archive a keyword (soft delete). The keyword is not permanently deleted but marked as `archived`.

**Path Parameters**
- `id` (required) - Keyword UUID

**Response** (204 No Content)

No response body.

**Error Responses**
- `404` - Keyword not found

**Examples**

```bash
curl -X DELETE http://localhost:8787/api/keywords/550e8400-e29b-41d4-a716-446655440000
```

---

## Mentions API

Access and filter mentions data.

### List Mentions

**GET /api/mentions**

List mentions with filtering and pagination.

**Query Parameters**
- `keywordId` (optional) - Filter by keyword UUID
- `source` (optional) - Filter by source: `reddit` | `x` | `feed`
- `from` (optional) - Filter by date (ISO 8601 format)
- `to` (optional) - Filter by date (ISO 8601 format)
- `limit` (optional) - Results per page (min: 1, max: 100, default: 20)
- `offset` (optional) - Offset for pagination (default: 0)

**Response**
```json
{
  "mentions": [
    {
      "id": "m-123456",
      "source": "reddit",
      "sourceId": "abc123",
      "title": "ElysiaJS is amazing!",
      "content": "Just tried ElysiaJS and it's incredibly fast...",
      "url": "https://reddit.com/r/programming/comments/abc123",
      "author": "developer123",
      "createdAt": "2026-01-16T09:30:00Z",
      "fetchedAt": "2026-01-16T10:00:00Z",
      "matchedKeywords": ["550e8400-e29b-41d4-a716-446655440000"]
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

**Examples**

```bash
# Get first page
curl http://localhost:8787/api/mentions?limit=10&offset=0

# Filter by keyword
curl http://localhost:8787/api/mentions?keywordId=550e8400-e29b-41d4-a716-446655440000

# Filter by source
curl http://localhost:8787/api/mentions?source=reddit

# Filter by date range
curl http://localhost:8787/api/mentions?from=2026-01-01&to=2026-01-16

# Combine filters
curl http://localhost:8787/api/mentions?keywordId=550e8400-e29b-41d4-a716-446655440000&source=reddit&limit=50
```

---

### Get Mention

**GET /api/mentions/:id**

Get a specific mention by ID.

**Path Parameters**
- `id` (required) - Mention ID

**Response**
```json
{
  "id": "m-123456",
  "source": "reddit",
  "sourceId": "abc123",
  "title": "ElysiaJS is amazing!",
  "content": "Just tried ElysiaJS and it's incredibly fast...",
  "url": "https://reddit.com/r/programming/comments/abc123",
  "author": "developer123",
  "createdAt": "2026-01-16T09:30:00Z",
  "fetchedAt": "2026-01-16T10:00:00Z",
  "matchedKeywords": ["550e8400-e29b-41d4-a716-446655440000"]
}
```

**Error Responses**
- `404` - Mention not found

**Examples**

```bash
curl http://localhost:8787/api/mentions/m-123456
```

---

## Trends API

View aggregated trends and analytics.

### Get Trends Overview

**GET /api/trends/overview**

Get overview of trending keywords with growth rates.

**Query Parameters**
- `from` (optional) - Start date (ISO 8601 format, default: 7 days ago)
- `to` (optional) - End date (ISO 8601 format, default: today)

**Response**
```json
{
  "topKeywords": [
    {
      "keywordId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "ElysiaJS",
      "currentPeriod": 150,
      "previousPeriod": 80,
      "growthRate": 87.5,
      "isEmerging": true
    }
  ],
  "emergingKeywords": [
    {
      "keywordId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "ElysiaJS",
      "currentPeriod": 150,
      "previousPeriod": 2,
      "growthRate": 7400,
      "isEmerging": true
    }
  ],
  "totalMentions": 1250,
  "sourceBreakdown": [
    {
      "source": "reddit",
      "count": 800
    },
    {
      "source": "x",
      "count": 350
    },
    {
      "source": "feed",
      "count": 100
    }
  ]
}
```

**Fields**
- `topKeywords` - Top 10 keywords by mention count
- `emergingKeywords` - Keywords with <3 mentions previously and ≥10 currently
- `totalMentions` - Total mentions across all keywords
- `sourceBreakdown` - Mentions grouped by source
- `growthRate` - Percentage growth vs previous period

**Examples**

```bash
# Get current week trends
curl http://localhost:8787/api/trends/overview

# Get specific date range
curl http://localhost:8787/api/trends/overview?from=2026-01-01&to=2026-01-16
```

---

### Get Keyword Trend

**GET /api/trends/:keywordId**

Get time series data for a specific keyword.

**Path Parameters**
- `keywordId` (required) - Keyword UUID

**Query Parameters**
- `from` (optional) - Start date (ISO 8601 format, default: 30 days ago)
- `to` (optional) - End date (ISO 8601 format, default: today)
- `source` (optional) - Filter by source: `reddit` | `x` | `feed`

**Response**
```json
{
  "keywordId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "ElysiaJS",
  "timeSeries": [
    {
      "date": "2026-01-15",
      "count": 45,
      "source": "reddit"
    },
    {
      "date": "2026-01-16",
      "count": 52,
      "source": "reddit"
    }
  ],
  "totalMentions": 1250,
  "averagePerDay": 41.67
}
```

**Error Responses**
- `404` - Keyword not found

**Examples**

```bash
# Get trend for keyword
curl http://localhost:8787/api/trends/550e8400-e29b-41d4-a716-446655440000

# Filter by source
curl http://localhost:8787/api/trends/550e8400-e29b-41d4-a716-446655440000?source=reddit

# Custom date range
curl http://localhost:8787/api/trends/550e8400-e29b-41d4-a716-446655440000?from=2026-01-01&to=2026-01-16
```

---

## OpenAPI Specification

The API includes an OpenAPI (Swagger) specification available at:

**GET /swagger**

Access the interactive API documentation UI.

---

## Rate Limiting

Currently, no rate limiting is enforced. This will be added in future versions.

---

## Versioning

The API is currently at version 1.0. Future breaking changes will be introduced with a new version prefix.

---

## Support

For issues or questions, please refer to the main project repository.
