# Monorepo Reference

This document describes the monorepo structure, Turborepo configuration, and best practices for working with workspaces.

## Turborepo Configuration

The project uses Turborepo for task orchestration and caching.

### Key Features

- **Task pipelines**: Build tasks run dependencies first (`dependsOn: ["^build"]`)
- **Caching**: Test and lint tasks are cached for performance
- **Parallel execution**: Independent tasks run concurrently
- **Persistent tasks**: Dev servers (`dev`, `test:watch`) run continuously

### Pipeline Configuration

Located in `turbo.json`:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "cache": true,
      "dependsOn": ["^build"]
    },
    "lint": {
      "cache": true
    }
  }
}
```

**Task Types:**
- **Build tasks**: Have dependencies and produce outputs
- **Dev tasks**: Long-running, not cached
- **Test/Lint tasks**: Cached for performance

## Workspace Structure

The monorepo uses Bun workspaces defined in root `package.json`:

```json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

### Apps (apps/)

Independent deployable applications:
- `api-worker` - ElysiaJS API on Cloudflare Workers
- `processor-worker` - Queue consumer worker
- `ingestion-feeds` - RSS/Atom feed ingestion worker
- `aggregator-worker` - Scheduled aggregation worker
- `web` - React SPA frontend

### Packages (packages/)

Shared code libraries:
- `db` - Drizzle ORM schema and database client
- `types` - Shared TypeScript types
- `config` - Configuration constants
- `utils` - Utility functions

## Adding New Packages

When creating new shared packages:

1. **Create package directory:**
```bash
mkdir -p packages/[name]/src
cd packages/[name]
```

2. **Initialize package.json:**
```json
{
  "name": "@trend-monitor/[name]",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
```

3. **Add TypeScript config (tsconfig.json):**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

4. **Update root package.json:**
The workspace is automatically detected if it's in `apps/*` or `packages/*`.

5. **Reference in dependent apps:**
```json
{
  "dependencies": {
    "@trend-monitor/[name]": "workspace:*"
  }
}
```

6. **Install dependencies:**
```bash
bun install
```

## Code Quality

### Biome Configuration

Biome (replacement for ESLint + Prettier) is configured at the root in `biome.json`:

```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  }
}
```

**Key Settings:**
- Tab indentation (not spaces)
- 100 character line width
- TailwindCSS class sorting enabled (warn level)
- Git-aware (respects `.gitignore`)
- Runs on all TypeScript/JavaScript files

### Running Biome

```bash
# Check all files
bun run lint

# Fix formatting and linting issues
bun run format:fix

# Check specific workspace
cd apps/api-worker
bun run lint

# Root-level check
bun check  # Runs Biome directly
```

### Pre-commit Hooks

Consider setting up pre-commit hooks to run Biome automatically:

```bash
# .husky/pre-commit
#!/bin/sh
bun run lint
```

## Dependency Management

### Installing Dependencies

```bash
# Install in specific workspace
cd apps/api-worker
bun add elysia

# Install in root (for tooling)
bun add -D typescript

# Install in all workspaces
bun install
```

### Updating Dependencies

```bash
# Update all dependencies
bun update

# Update specific package
bun update elysia

# Check outdated packages
bun outdated
```

### Workspace Dependencies

Always use `workspace:*` protocol for internal dependencies:

```json
{
  "dependencies": {
    "@trend-monitor/db": "workspace:*",
    "@trend-monitor/types": "workspace:*"
  }
}
```

## Best Practices

1. **Shared Code**: Extract common patterns to `packages/` for reuse
2. **Type Safety**: Export types from shared packages for consistency
3. **Build Order**: Use `dependsOn: ["^build"]` for correct build order
4. **Cache Wisely**: Cache deterministic tasks (test, lint) but not dev servers
5. **Isolated Testing**: Each package should have its own test suite
6. **Documentation**: Document shared packages in their README files
7. **Versioning**: Use `0.0.0` for internal packages (not published)

## Troubleshooting

### Cache Issues

If experiencing stale cache issues:

```bash
# Clear Turborepo cache
rm -rf .turbo

# Clear Bun cache
rm -rf node_modules .bun
bun install
```

### Build Issues

If builds fail:

```bash
# Build in order
bun run build

# Check specific workspace
cd packages/db
bun run build
```

### Type Errors

If TypeScript can't find types:

```bash
# Regenerate types
cd apps/api-worker
bun run wrangler:types

# Rebuild packages
cd packages/db
bun run build
```
