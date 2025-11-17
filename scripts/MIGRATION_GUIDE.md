# Data Migration Guide

This guide provides instructions for migrating data from AWS/Redis infrastructure to Cloudflare services.

## Overview

The migration process consists of three main scripts:

1. **S3 to R2 Migration** - Migrates file storage from AWS S3 to Cloudflare R2
2. **PostgreSQL to D1 Migration** - Migrates database from PostgreSQL to Cloudflare D1
3. **Redis to KV Migration** - Migrates job queue data from Redis to Cloudflare KV and Durable Objects

## Prerequisites

### General Requirements

- Node.js v20.0.0 or higher
- npm or yarn package manager
- Wrangler CLI installed globally: `npm install -g wrangler`
- Access to source infrastructure (AWS, PostgreSQL, Redis)
- Cloudflare account with appropriate permissions

### Required Packages

Install the required dependencies:

```bash
npm install @aws-sdk/client-s3 pg ioredis tsx
```

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=your-database-name
POSTGRES_USER=your-username
POSTGRES_PASSWORD=your-password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=ai-resume-storage
KV_NAMESPACE_ID=your-kv-namespace-id
D1_DATABASE_NAME=ai-resume-db
WORKER_NAME=ai-resume-portfolio

# Migration Settings
PARALLEL_TRANSFERS=5
BATCH_SIZE=100
VERIFY_CHECKSUMS=true
VERIFY_DATA=true
VERIFY_JOBS=true
ROLLBACK_ON_ERROR=false
```

## Migration Process

### Step 1: Prepare Cloudflare Infrastructure

Before running migrations, ensure all Cloudflare resources are created:

```bash
# Run the setup script
./scripts/setup-cloudflare.sh

# Apply D1 migrations
./scripts/apply-d1-migration.sh
```

### Step 2: S3 to R2 Migration

Migrate all files from AWS S3 to Cloudflare R2:

```bash
# Run the migration script
./scripts/migrate-s3-to-r2.sh

# Or run directly with TypeScript
npx tsx scripts/migrate-s3-to-r2.ts
```

**Features:**
- Parallel file transfers (configurable with `PARALLEL_TRANSFERS`)
- MD5 checksum verification
- Resume capability for interrupted migrations
- Comprehensive logging
- Rollback mechanism on failure

**Output:**
- Log file: `logs/s3-to-r2-migration.log`
- Checkpoint file: `logs/s3-to-r2-checkpoint.json`

**Verification:**

```bash
# List files in R2 bucket
wrangler r2 object list ai-resume-storage

# Check specific file
wrangler r2 object get ai-resume-storage/path/to/file.pdf
```

### Step 3: PostgreSQL to D1 Migration

Migrate database schema and data from PostgreSQL to D1:

```bash
# Run the migration script
./scripts/migrate-postgres-to-d1.sh

# Or run directly with TypeScript
npx tsx scripts/migrate-postgres-to-d1.ts
```

**Features:**
- Exports all tables to JSON format
- Automatic type conversion (UUID → String, JSONB → TEXT, Boolean → Integer)
- Batch import using D1 batch API
- Referential integrity validation
- Row count and sample record verification
- Rollback capability

**Output:**
- Log file: `logs/postgres-to-d1-migration.log`
- Export directory: `migration-data/`
- Summary file: `migration-data/migration-summary.json`

**Verification:**

```bash
# Check row counts
wrangler d1 execute ai-resume-db --command="SELECT COUNT(*) FROM users" --local

# View sample data
wrangler d1 execute ai-resume-db --command="SELECT * FROM users LIMIT 5" --local

# Check all tables
wrangler d1 execute ai-resume-db --command="SELECT name FROM sqlite_master WHERE type='table'" --local
```

### Step 4: Redis to KV Migration

Migrate job queue data from Redis to Cloudflare KV and Durable Objects:

```bash
# Run the migration script
./scripts/migrate-redis-to-kv.sh

# Or run directly with TypeScript
npx tsx scripts/migrate-redis-to-kv.ts
```

**Features:**
- Exports active, waiting, delayed, completed, and failed jobs
- Transforms Bull queue format to Durable Object format
- Imports job states to KV for caching
- Recreates active jobs in Durable Objects
- Job verification

**Output:**
- Log file: `logs/redis-to-kv-migration.log`
- Export file: `migration-data/redis-jobs-export.json`
- Summary file: `migration-data/redis-migration-summary.json`

**Verification:**

```bash
# Check KV namespace contents via Cloudflare dashboard
# Or use wrangler
wrangler kv:key list --namespace-id=your-kv-namespace-id

# Check specific job
wrangler kv:key get "job:session-id" --namespace-id=your-kv-namespace-id
```

## Migration Order

**Recommended order for production migration:**

1. **Preparation Phase**
   - Set up Cloudflare infrastructure
   - Apply D1 migrations
   - Test scripts on staging environment

2. **Data Migration Phase** (during maintenance window)
   - Run S3 to R2 migration (can take hours for large datasets)
   - Run PostgreSQL to D1 migration
   - Run Redis to KV migration

3. **Verification Phase**
   - Verify all data transferred successfully
   - Check row counts and checksums
   - Test application functionality

4. **Cutover Phase**
   - Update application configuration to use Cloudflare services
   - Deploy updated application
   - Monitor for errors

5. **Cleanup Phase** (after 7+ days of stable operation)
   - Decommission AWS resources
   - Remove old credentials

## Rollback Procedures

### S3 to R2 Rollback

If migration fails and `ROLLBACK_ON_ERROR=true`:

```bash
# Automatic rollback will delete all transferred files from R2
# Manual rollback:
wrangler r2 object delete ai-resume-storage/path/to/file.pdf
```

### PostgreSQL to D1 Rollback

If migration fails and `ROLLBACK_ON_ERROR=true`:

```bash
# Automatic rollback will clear all D1 tables
# Manual rollback:
wrangler d1 execute ai-resume-db --command="DELETE FROM table_name" --local
```

### Redis to KV Rollback

```bash
# Delete all migrated keys from KV
wrangler kv:key delete "job:session-id" --namespace-id=your-kv-namespace-id
```

## Troubleshooting

### Common Issues

**1. Connection Timeouts**
- Increase timeout values in scripts
- Check network connectivity
- Verify credentials

**2. Checksum Mismatches**
- Retry the specific file
- Check for data corruption
- Verify S3/R2 configuration

**3. Type Conversion Errors**
- Review PostgreSQL schema
- Check D1 migration SQL
- Verify data transformations

**4. Rate Limiting**
- Reduce `PARALLEL_TRANSFERS` or `BATCH_SIZE`
- Add delays between operations
- Use Cloudflare paid plan for higher limits

**5. Memory Issues**
- Process data in smaller batches
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`

### Logs and Debugging

All migration scripts create detailed logs:

```bash
# View logs
tail -f logs/s3-to-r2-migration.log
tail -f logs/postgres-to-d1-migration.log
tail -f logs/redis-to-kv-migration.log

# Check summaries
cat migration-data/migration-summary.json
cat migration-data/redis-migration-summary.json
```

## Performance Optimization

### S3 to R2 Migration

- Increase `PARALLEL_TRANSFERS` for faster transfers (default: 5)
- Disable checksum verification for faster migration (not recommended)
- Run from EC2 instance in same region as S3 bucket

### PostgreSQL to D1 Migration

- Increase `BATCH_SIZE` for faster imports (default: 100)
- Run during off-peak hours
- Consider exporting large tables separately

### Redis to KV Migration

- Export only active jobs if completed jobs are not needed
- Run during low-traffic periods
- Verify jobs after migration

## Testing

Before running production migration, run the comprehensive test suite:

```bash
# Run automated tests
./scripts/test-migrations.sh

# Or run directly
npx tsx scripts/test-migrations.ts
```

The test suite will:
- Generate sample data for all migration types
- Verify data integrity and checksums
- Test migration script syntax
- Validate rollback mechanisms
- Check documentation completeness
- Verify environment variable handling
- Test logging and progress tracking

For detailed testing instructions, see [TESTING_GUIDE.md](./TESTING_GUIDE.md).

### Manual Testing

After automated tests pass:

1. **Test on Staging**
   ```bash
   # Use staging credentials
   export S3_BUCKET_NAME=staging-bucket
   export POSTGRES_DB=staging-db
   ./scripts/migrate-s3-to-r2.sh
   ```

2. **Verify Data Integrity**
   ```bash
   # Compare row counts
   # Check sample records
   # Test application functionality
   ```

3. **Test Rollback**
   ```bash
   export ROLLBACK_ON_ERROR=true
   # Trigger a failure to test rollback
   ```

## Support

For issues or questions:

1. Check logs in `logs/` directory
2. Review migration summaries in `migration-data/`
3. Consult Cloudflare documentation
4. Contact Cloudflare support for platform issues

## References

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Cloudflare Durable Objects Documentation](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
