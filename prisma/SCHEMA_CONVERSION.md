# Prisma Schema Conversion Guide

This document details the conversion of the Prisma schema from PostgreSQL to SQLite for Cloudflare D1 compatibility.

## Overview

The AI Resume Portfolio application has been migrated from PostgreSQL to SQLite/D1. This required converting several PostgreSQL-specific types to SQLite-compatible equivalents.

## Type Conversion Summary

| PostgreSQL Type | SQLite Type | Code Handling | Example |
|----------------|-------------|---------------|---------|
| `UUID` | `TEXT` | `crypto.randomUUID()` | `id: crypto.randomUUID()` |
| `JSONB` | `TEXT` | `JSON.stringify()` / `JSON.parse()` | `JSON.stringify(data)` |
| `BOOLEAN` | `INTEGER` | `? 1 : 0` / `=== 1` | `isPublished ? 1 : 0` |
| `TIMESTAMP` | `TEXT` | `new Date().toISOString()` | `new Date().toISOString()` |
| `DECIMAL` | `REAL` | Direct number | `0.8542` |

## Detailed Conversions

### 1. UUID Fields

**Before (PostgreSQL):**
```prisma
model User {
  id String @id @default(uuid())
}
```

**After (SQLite):**
```prisma
model User {
  id String @id // UUID stored as String, generated with crypto.randomUUID()
}
```

**Code Implementation:**
```typescript
// Generate UUID in application code
const id = crypto.randomUUID();

await db.prepare('INSERT INTO users (id, email) VALUES (?, ?)')
  .bind(id, email)
  .run();
```

**Affected Fields:**
- `User.id`
- `ResumeSession.id`
- `Portfolio.id`
- `ParsingMetric.id`

### 2. JSON Fields

**Before (PostgreSQL):**
```prisma
model ResumeSession {
  parsedData Json? @map("parsed_data")
}
```

**After (SQLite):**
```prisma
model ResumeSession {
  parsedData String? @map("parsed_data") // JSON stored as String
}
```

**Code Implementation:**
```typescript
// Storing JSON
const parsedDataJson = JSON.stringify(parsedData);
await db.prepare('INSERT INTO resume_sessions (parsed_data) VALUES (?)')
  .bind(parsedDataJson)
  .run();

// Retrieving JSON
const session = await db.prepare('SELECT * FROM resume_sessions WHERE id = ?')
  .bind(id)
  .first<ResumeSession>();

const parsedData = session.parsed_data 
  ? JSON.parse(session.parsed_data) 
  : null;
```

**Helper Methods in DatabaseService:**
```typescript
getParsedData(session: ResumeSession): ParsedResumeData | null {
  if (!session.parsed_data) return null;
  try {
    return JSON.parse(session.parsed_data) as ParsedResumeData;
  } catch {
    return null;
  }
}

getCustomizations(portfolio: Portfolio): Record<string, any> | null {
  if (!portfolio.customizations) return null;
  try {
    return JSON.parse(portfolio.customizations);
  } catch {
    return null;
  }
}
```

**Affected Fields:**
- `ResumeSession.parsedData` - Stores parsed resume data
- `Portfolio.customizations` - Stores template customizations

### 3. Boolean Fields

**Before (PostgreSQL):**
```prisma
model Portfolio {
  isPublished Boolean @default(false) @map("is_published")
}
```

**After (SQLite):**
```prisma
model Portfolio {
  isPublished Int @default(0) @map("is_published") // Boolean stored as Int (0/1)
}
```

**Code Implementation:**
```typescript
// Storing boolean
const isPublished = input.isPublished ? 1 : 0;
await db.prepare('INSERT INTO portfolios (is_published) VALUES (?)')
  .bind(isPublished)
  .run();

// Retrieving boolean
const portfolio = await db.prepare('SELECT * FROM portfolios WHERE id = ?')
  .bind(id)
  .first<Portfolio>();

const isPublished = portfolio.is_published === 1;
```

**Helper Methods in DatabaseService:**
```typescript
isPortfolioPublished(portfolio: Portfolio): boolean {
  return portfolio.is_published === 1;
}

wasMetricEdited(metric: ParsingMetric): boolean {
  return metric.was_edited === 1;
}
```

**Affected Fields:**
- `Portfolio.isPublished` - Whether portfolio is published (0 = false, 1 = true)
- `ParsingMetric.wasEdited` - Whether metric was manually edited (0 = false, 1 = true)

### 4. Timestamp Fields

**Before (PostgreSQL):**
```prisma
model User {
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
}
```

**After (SQLite):**
```prisma
model User {
  createdAt String @map("created_at") // ISO 8601 timestamp string
  updatedAt String @map("updated_at") // ISO 8601 timestamp string
}
```

**Code Implementation:**
```typescript
// Storing timestamp
const now = new Date().toISOString();
await db.prepare('INSERT INTO users (created_at, updated_at) VALUES (?, ?)')
  .bind(now, now)
  .run();

// Retrieving timestamp
const user = await db.prepare('SELECT * FROM users WHERE id = ?')
  .bind(id)
  .first<User>();

const createdAt = new Date(user.created_at); // Parse ISO 8601 string
```

**ISO 8601 Format:**
```
2024-01-15T10:30:45.123Z
```

**Affected Fields:**
- `User.createdAt`, `User.updatedAt`
- `ResumeSession.createdAt`, `ResumeSession.updatedAt`
- `Portfolio.createdAt`, `Portfolio.updatedAt`
- `ParsingMetric.createdAt`

### 5. Decimal/Numeric Fields

**Before (PostgreSQL):**
```prisma
model ParsingMetric {
  confidenceScore Decimal @map("confidence_score")
}
```

**After (SQLite):**
```prisma
model ParsingMetric {
  confidenceScore Float @map("confidence_score") // Decimal stored as Float
}
```

**Code Implementation:**
```typescript
// No conversion needed - JavaScript numbers work directly
const confidenceScore = 0.8542;
await db.prepare('INSERT INTO parsing_metrics (confidence_score) VALUES (?)')
  .bind(confidenceScore)
  .run();
```

**Affected Fields:**
- `ParsingMetric.confidenceScore` - Confidence score for parsed fields (0.0 to 1.0)

## Schema Files

### Prisma Schema
- **Location:** `prisma/schema.prisma`
- **Provider:** `sqlite`
- **Purpose:** Type definitions for Prisma Client

### Prisma Migration
- **Location:** `prisma/migrations/20240101000000_init/migration.sql`
- **Format:** Prisma migration format
- **Purpose:** Local development with Prisma

### D1 Migration
- **Location:** `prisma/migrations/d1_initial_migration.sql`
- **Format:** SQLite DDL with D1-specific features
- **Purpose:** Production deployment to Cloudflare D1

## Migration Commands

### Local Development (Prisma)
```bash
# Generate Prisma client
npx prisma generate

# Apply migrations to local SQLite
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

### Cloudflare D1 (Production)
```bash
# Create D1 database
wrangler d1 create ai-resume-db

# Apply D1 migration
wrangler d1 execute ai-resume-db --file=./prisma/migrations/d1_initial_migration.sql

# Or use the helper script
./scripts/apply-d1-migration.sh ai-resume-db

# Query D1 database
wrangler d1 execute ai-resume-db --command="SELECT * FROM users"

# List tables
wrangler d1 execute ai-resume-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Database Service

The `DatabaseService` class (`src/services/database.ts`) provides a clean API that handles all type conversions automatically:

```typescript
import { DatabaseService } from '@/services/database';
import { CloudflareEnv } from '@/config/cloudflare-env';

const db = new DatabaseService(env);

// Create user (UUID generated automatically)
const user = await db.createUser({ email: 'user@example.com' });

// Create resume session (JSON serialized automatically)
const session = await db.createResumeSession({
  userId: user.id,
  originalFilename: 'resume.pdf',
  fileFormat: 'pdf',
  processingStatus: 'pending',
  parsedData: { name: 'John Doe', email: 'john@example.com' }
});

// Get parsed data (JSON deserialized automatically)
const parsedData = db.getParsedData(session);

// Create portfolio (boolean converted automatically)
const portfolio = await db.createPortfolio({
  userId: user.id,
  sessionId: session.id,
  templateId: 'modern',
  isPublished: true, // Stored as 1
  customizations: { theme: 'dark' } // Stored as JSON string
});

// Check if published (integer converted to boolean)
const isPublished = db.isPortfolioPublished(portfolio);
```

## Testing

All database operations are tested with Miniflare's D1 mock:

```typescript
import { getMiniflareBindings } from '@/test/setup';
import { DatabaseService } from '@/services/database';

describe('DatabaseService', () => {
  let env: CloudflareEnv;
  let db: DatabaseService;

  beforeEach(() => {
    env = getMiniflareBindings();
    db = new DatabaseService(env);
  });

  it('should handle JSON serialization', async () => {
    const session = await db.createResumeSession({
      userId: 'user-123',
      originalFilename: 'resume.pdf',
      fileFormat: 'pdf',
      processingStatus: 'pending',
      parsedData: { name: 'John Doe' }
    });

    const parsedData = db.getParsedData(session);
    expect(parsedData).toEqual({ name: 'John Doe' });
  });

  it('should handle boolean conversion', async () => {
    const portfolio = await db.createPortfolio({
      userId: 'user-123',
      sessionId: 'session-123',
      templateId: 'modern',
      isPublished: true
    });

    expect(portfolio.is_published).toBe(1);
    expect(db.isPortfolioPublished(portfolio)).toBe(true);
  });
});
```

## Best Practices

### 1. Always Use Helper Methods
```typescript
// ❌ Don't access raw fields directly
const isPublished = portfolio.is_published === 1;

// ✅ Use helper methods
const isPublished = db.isPortfolioPublished(portfolio);
```

### 2. Handle JSON Parsing Errors
```typescript
// ❌ Don't assume JSON is valid
const data = JSON.parse(session.parsed_data);

// ✅ Use helper methods with error handling
const data = db.getParsedData(session);
if (!data) {
  // Handle invalid JSON
}
```

### 3. Use ISO 8601 for Timestamps
```typescript
// ❌ Don't use Date.now() or custom formats
const now = Date.now().toString();

// ✅ Use ISO 8601 format
const now = new Date().toISOString();
```

### 4. Generate UUIDs in Code
```typescript
// ❌ Don't rely on database to generate IDs
// (SQLite doesn't have UUID generation)

// ✅ Generate UUIDs in application code
const id = crypto.randomUUID();
```

## SQLite Limitations

### No ALTER TABLE for Foreign Keys
SQLite doesn't support adding foreign keys after table creation. All foreign keys must be defined in the initial CREATE TABLE statement.

### No Native UUID Type
SQLite doesn't have a native UUID type. UUIDs are stored as TEXT and generated in application code.

### No Native JSON Type
SQLite doesn't have a native JSON type. JSON is stored as TEXT and parsed in application code.

### No Native Boolean Type
SQLite doesn't have a native boolean type. Booleans are stored as INTEGER (0/1).

### Case-Sensitive LIKE
SQLite's LIKE operator is case-sensitive by default. Use COLLATE NOCASE for case-insensitive searches:
```sql
SELECT * FROM users WHERE email LIKE '%@example.com' COLLATE NOCASE
```

## Resources

- [Prisma SQLite Documentation](https://www.prisma.io/docs/concepts/database-connectors/sqlite)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [SQLite Data Types](https://www.sqlite.org/datatype3.html)
- [ISO 8601 Timestamp Format](https://en.wikipedia.org/wiki/ISO_8601)
