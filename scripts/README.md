# Migration Scripts

This directory contains scripts for migrating from AWS/Redis infrastructure to Cloudflare services.

## Quick Start

### Run Tests
```bash
./scripts/test-migrations.sh
```

### Run Migrations
```bash
# 1. S3 to R2
./scripts/migrate-s3-to-r2.sh

# 2. PostgreSQL to D1
./scripts/migrate-postgres-to-d1.sh

# 3. Redis to KV
./scripts/migrate-redis-to-kv.sh
```

## Available Scripts

### Migration Scripts
- `migrate-s3-to-r2.ts` / `.sh` - Migrate files from AWS S3 to Cloudflare R2
- `migrate-postgres-to-d1.ts` / `.sh` - Migrate database from PostgreSQL to D1
- `migrate-redis-to-kv.ts` / `.sh` - Migrate job queue from Redis to KV/Durable Objects

### Testing Scripts
- `test-migrations.ts` / `.sh` - Comprehensive test suite for all migration scripts

### Setup Scripts
- `setup-cloudflare.sh` - Initial Cloudflare infrastructure setup
- `apply-d1-migration.sh` - Apply D1 database migrations

### Utility Scripts
- `prepare-pages-deployment.js` - Prepare Next.js app for Cloudflare Pages

## Documentation

- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Complete migration guide
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing procedures and best practices

## Prerequisites

- Node.js v20.0.0+
- Wrangler CLI: `npm install -g wrangler`
- Required packages: `npm install`

## Configuration

Create a `.env` file with required credentials:

```bash
# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=

# PostgreSQL
POSTGRES_HOST=
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=

# Redis
REDIS_HOST=
REDIS_PORT=

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
KV_NAMESPACE_ID=
D1_DATABASE_NAME=
```

## Support

For issues or questions, see the documentation or check the logs in `logs/` directory.
