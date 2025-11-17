# Database Migrations

This directory contains database migrations for the AI Resume Portfolio application, converted from PostgreSQL to SQLite for Cloudflare D1 compatibility.

## Migration Structure

- `20240101000000_init/migration.sql` - Prisma-generated SQLite migration
- `d1_initial_migration.sql` - D1-specific migration for Cloudflare deployment
- `migration_lock.toml` - Prisma migration lock file

## Type Conversions from PostgreSQL to SQLite

The following type conversions were made to ensure D1/SQLite compatibility:

### 1. UUID → TEXT
**PostgreSQL:**
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

**SQLite:**
```sql
id TEXT PRIMARY KEY
```

**Code Implementation:**
```typescript
const id = crypto.randomUUID(); // Generate UUID in application code
```

### 2. JSONB → TEXT
**PostgreSQL:**
```sql
parsed_data JSONB
customizations JSONB
```

**SQLite:**
```sql
parsed_data TEXT
customizations TEXT
```

**Code Implementation:**
```typescript
// Storing
const parsedDataJson = JSON.stringify(parsedData);
await db.prepare('INSERT INTO resume_sessions (parsed_data) VALUES (?)').bind(parsedDataJson);

// Retrieving
const session = await db.prepare('SELECT * FROM resume_sessions WHERE id = ?').first();
const parsedData = JSON.parse(session.parsed_data);
```

### 3. BOOLEAN → INTEGER
**PostgreSQL:**
```sql
is_published BOOLEAN DEFAULT false
was_edited BOOLEAN DEFAULT false
```

**SQLite:**
```sql
is_published INTEGER DEFAULT 0
was_edited INTEGER DEFAULT 0
```

**Code Implementation:**
```typescript
// Storing
const isPublished = input.isPublished ? 1 : 0;
await db.prepare('INSERT INTO portfolios (is_published) VALUES (?)').bind(isPublished);

// Retrieving
const portfolio = await db.prepare('SELECT * FROM portfolios WHERE id = ?').first();
const isPublished = portfolio.is_published === 1; // Convert to boolean
```

### 4. TIMESTAMP → TEXT (ISO 8601)
**PostgreSQL:**
```sql
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

**SQLite:**
```sql
created_at TEXT DEFAULT (datetime('now'))
updated_at TEXT DEFAULT (datetime('now'))
```

**Code Implementation:**
```typescript
// Storing
const now = new Date().toISOString();
await db.prepare('INSERT INTO users (created_at, updated_at) VALUES (?, ?)').bind(now, now);

// Retrieving
const user = await db.prepare('SELECT * FROM users WHERE id = ?').first();
const createdAt = new Date(user.created_at); // Parse ISO 8601 string
```

### 5. DECIMAL → REAL
**PostgreSQL:**
```sql
confidence_score DECIMAL(5,4)
```

**SQLite:**
```sql
confidence_score REAL
```

**Code Implementation:**
```typescript
// No conversion needed - JavaScript numbers work directly
const confidenceScore = 0.8542;
await db.prepare('INSERT INTO parsing_metrics (confidence_score) VALUES (?)').bind(confidenceScore);
```

## Running Migrations

### For Local Development (Prisma)
```bash
# Generate Prisma client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### For Cloudflare D1
```bash
# Create D1 database
wrangler d1 create ai-resume-db

# Apply D1 migration
wrangler d1 execute ai-resume-db --file=./prisma/migrations/d1_initial_migration.sql

# Verify migration
wrangler d1 execute ai-resume-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Schema Validation

The Prisma schema (`prisma/schema.prisma`) is configured for SQLite and includes:

- All fields use SQLite-compatible types
- String fields for UUIDs (generated in code)
- String fields for JSON data (serialized in code)
- Int fields for booleans (converted in code)
- String fields for timestamps (ISO 8601 format)
- Float fields for decimals

## Database Service

The `DatabaseService` class (`src/services/database.ts`) handles all type conversions automatically:

- `crypto.randomUUID()` for ID generation
- `JSON.stringify()` / `JSON.parse()` for JSON fields
- `? 1 : 0` / `=== 1` for boolean conversions
- `new Date().toISOString()` for timestamps
- Helper methods like `getParsedData()`, `getCustomizations()`, `isPortfolioPublished()`, `wasMetricEdited()`

## Foreign Key Constraints

SQLite foreign key constraints are enabled by default in D1. All relationships use `ON DELETE CASCADE` to maintain referential integrity:

- Deleting a user cascades to their resume sessions and portfolios
- Deleting a resume session cascades to its portfolios and parsing metrics

## Indexes

Performance indexes are created for all foreign key columns:

- `idx_resume_sessions_user_id` - Fast user session lookups
- `idx_portfolios_user_id` - Fast user portfolio lookups
- `idx_portfolios_session_id` - Fast session portfolio lookups
- `idx_parsing_metrics_session_id` - Fast session metrics lookups
- `idx_users_email` - Fast email lookups (unique constraint)

## Testing

All database operations are tested in `src/services/__tests__/database.test.ts` using Miniflare's D1 mock:

```typescript
import { getMiniflareBindings } from '@/test/setup';

const env = getMiniflareBindings();
const db = new DatabaseService(env);
```

## Notes

- SQLite does not support `ALTER TABLE` for adding foreign keys after table creation
- All migrations must be applied in order
- D1 uses SQLite 3.x syntax
- Maximum row size in D1 is 1MB
- TEXT fields can store up to 1GB of data
