# API Worker

ElysiaJS-based REST API running on Cloudflare Workers for the Trend Monitor application.

## Overview

This API provides endpoints for managing keywords, viewing trends, and accessing mentions data. It connects to Cloudflare D1 (SQLite) for data persistence and is designed to be deployed as a Cloudflare Worker.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: ElysiaJS with OpenAPI support
- **Database**: Cloudflare D1 (SQLite)
- **Language**: TypeScript
- **Testing**: Bun Test
- **Validation**: Elysia type validation

## Development

### Prerequisites

- Bun installed
- Wrangler CLI installed

### Setup

```bash
# Install dependencies
bun install

# Run database migrations
wrangler d1 execute trend-monitor-local --local --file migrations/0001_init_schema.sql

# Start local dev server
bun run dev
```

### Available Scripts

```bash
# Development
bun run dev              # Start local dev server with hot reload

# Testing
bun test                 # Run all tests
bun run test:unit        # Run unit tests
bun run test:integration # Run integration tests
bun run test:watch       # Run tests in watch mode
bun run test:coverage    # Run tests with coverage

# Type checking & Linting
bun run typecheck        # TypeScript type checking
bun run lint             # Check code with Biome
bun run format           # Format code with Biome
bun run format:fix       # Fix formatting issues

# Build & Deploy
bun run build            # Build and dry-run deployment
bun run deploy           # Deploy to Cloudflare Workers
```

## Project Structure

```
apps/api-worker/
├── src/
│   ├── modules/           # Feature modules
│   │   ├── keywords/      # Keywords CRUD endpoints
│   │   ├── mentions/      # Mentions listing endpoints
│   │   └── trends/        # Trends aggregation endpoints
│   ├── services/          # Business logic services
│   │   └── trends-service.ts
│   ├── lib/              # Shared libraries
│   │   └── db/           # Database utilities
│   └── index.ts          # Main app entry point
├── migrations/           # D1 database migrations
├── test/                # Test utilities
└── package.json
```

## API Endpoints

### Health Check
- `GET /api/health` - API health check

### Keywords
- `GET /api/keywords` - List keywords with optional filtering
- `POST /api/keywords` - Create a new keyword
- `GET /api/keywords/:id` - Get keyword by ID
- `PUT /api/keywords/:id` - Update keyword
- `DELETE /api/keywords/:id` - Archive keyword (soft delete)

### Mentions
- `GET /api/mentions` - List mentions with filtering and pagination
- `GET /api/mentions/:id` - Get mention by ID

### Trends
- `GET /api/trends/overview` - Get trends overview with top keywords
- `GET /api/trends/:keywordId` - Get keyword-specific trend data

For detailed API documentation, see [API Reference](./docs/api-reference.md).

## Database Schema

### Keywords Table
Stores monitored keywords with aliases and tags.

### Mentions Table
Normalized posts/tweets/articles matching keywords.

### Daily Aggregates Table
Pre-aggregated daily mention counts per keyword/source for fast queries.

## Testing

The project uses a comprehensive testing approach:

- **Unit Tests**: Module-level tests for repositories and routes
- **Integration Tests**: Full workflow tests covering CRUD and filtering
- **Mock Database**: In-memory SQLite for fast test execution

```bash
# Run all tests
bun test

# Run specific test file
bun test src/modules/keywords/index.test.ts

# Run with coverage
bun run test:coverage
```

## Environment Variables

Configure in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "trend-monitor-local"
database_id = "local"
migrations_dir = "migrations"
```

## Deployment

```bash
# Deploy to production
bun run deploy

# Deploy with dry run (test build)
bun run build
```

## Architecture Decisions

### Modular Structure
Each feature is organized as a module with its routes, repository, and tests co-located.

### Repository Pattern
Database access is abstracted through repository classes for easy testing and maintainability.

### Service Layer
Complex business logic (like trends calculation) is encapsulated in service classes.

### Type Safety
Full TypeScript coverage with shared types in `@trend-monitor/types` package.

### TDD Approach
Tests are written first to ensure reliable implementation.

## CORS

CORS is enabled for all origins to support frontend development. Configure in production as needed.

## Error Handling

Errors are handled consistently using Elysia's status helpers:
- `400` - Validation errors
- `404` - Resource not found
- `500` - Server errors

## Contributing

1. Create feature branch from `main`
2. Write tests first (TDD)
3. Implement feature
4. Ensure all tests pass
5. Run type checking and linting
6. Create pull request

## License

Private - Trend Monitor Project
