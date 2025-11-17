# Production Migration Guide

This guide provides step-by-step instructions for migrating the AI Resume-to-Portfolio application from AWS infrastructure to Cloudflare's edge platform in a production environment.

## Overview

The production migration involves:
- Migrating all files from AWS S3 to Cloudflare R2
- Migrating database from PostgreSQL to Cloudflare D1
- Migrating job queue from Redis to Cloudflare KV and Durable Objects
- Verifying 100% data transfer with checksums and row counts
- Testing application functionality with migrated data
- Monitoring for errors and performance issues
- Keeping AWS infrastructure running in parallel for rollback capability

## Prerequisites

### Required Access

- AWS credentials with full access to S3, PostgreSQL, and Redis
- Cloudflare account with access to R2, KV, D1, and Workers
- Wrangler CLI installed and authenticated
- Database access credentials for PostgreSQL
- Redis connection details

### Environment Variables

Create a `.env.production` file with all required variables:

```bash
# Environment
ENVIRONMENT=production

# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket

# PostgreSQL Configuration
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_DB=your-database
POSTGRES_USER=your-username
POSTGRES_PASSWORD=your-password

# Redis Configuration
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# R2 Configuration
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=ai-resume-storage

# KV Configuration
KV_NAMESPACE_ID=your-kv-namespace-id

# D1 Configuration
D1_DATABASE_NAME=ai-resume-db
D1_DATABASE_ID=your-d1-database-id

# Worker Configuration
WORKER_NAME=ai-resume-portfolio

# Migration Settings
MAINTENANCE_START=2024-01-15T02:00:00Z  # Optional: schedule maintenance window
MAINTENANCE_DURATION=120  # minutes

# Migration Toggles
RUN_S3_MIGRATION=true
RUN_POSTGRESQL_MIGRATION=true
RUN_REDIS_MIGRATION=true

# Verification Settings
VERIFY_DATA_INTEGRITY=true
TEST_APPLICATION=true
VERIFY_CHECKSUMS=true
VERIFY_DATA=true
VERIFY_JOBS=true

# Rollback Settings
ENABLE_AUTO_ROLLBACK=false  # Set to true for automatic rollback on failure
ROLLBACK_ON_ANY_ERROR=false  # Set to true to rollback on any error

# Parallel Processing
PARALLEL_TRANSFERS=5  # Number of parallel S3 to R2 transfers
BATCH_SIZE=100  # Batch size for D1 imports

# Confirmation
SKIP_CONFIRMATION=false  # Set to true to skip confirmation prompt
```

### Pre-Migration Checklist

- [ ] All environment variables are set correctly
- [ ] Wrangler CLI is installed and authenticated
- [ ] Cloudflare resources (R2, KV, D1) are created
- [ ] D1 database schema is applied
- [ ] Maintenance window is scheduled and communicated
- [ ] Backup of AWS data is created
- [ ] Team is notified of maintenance window
- [ ] Monitoring and alerting is configured

## Migration Process

### Step 1: Pre-Flight Checks

Run the pre-deployment check script to verify everything is ready:

```bash
chmod +x scripts/pre-deployment-check.sh
./scripts/pre-deployment-check.sh
```

This will verify:
- All required environment variables are set
- Cloudflare resources are accessible
- Database connectivity
- Migration scripts are present

### Step 2: Test Migration (Recommended)

Before running the production migration, test with sample data:

```bash
# Run migration tests
npm run test:migrations

# Or manually:
npx tsx scripts/test-migrations.ts
```

This will:
- Generate sample data
- Test migration scripts
- Verify data integrity
- Test rollback mechanisms

### Step 3: Schedule Maintenance Window

Set the maintenance window start time:

```bash
export MAINTENANCE_START="2024-01-15T02:00:00Z"
export MAINTENANCE_DURATION=120  # 2 hours
```

The migration script will wait until this time to begin.

### Step 4: Run Production Migration

Execute the production migration script:

```bash
# Load environment variables
source .env.production

# Make script executable
chmod +x scripts/production-migration.sh

# Run migration (with confirmation prompt)
./scripts/production-migration.sh

# Or skip confirmation (use with caution)
SKIP_CONFIRMATION=true ./scripts/production-migration.sh
```

Alternatively, run the TypeScript script directly:

```bash
npx tsx scripts/production-migration.ts
```

### Step 5: Monitor Migration Progress

The migration script provides real-time progress updates:

```
[2024-01-15T02:00:00Z] [INFO] ================================================================================
[2024-01-15T02:00:00Z] [INFO] PRODUCTION MIGRATION STARTED
[2024-01-15T02:00:00Z] [INFO] Migration ID: prod-migration-1705284000000
[2024-01-15T02:00:00Z] [INFO] ================================================================================
[2024-01-15T02:00:05Z] [INFO] 📦 Starting S3 to R2 migration...
[2024-01-15T02:15:30Z] [SUCCESS] ✓ S3 to R2 Migration completed in 925.45s
[2024-01-15T02:15:35Z] [INFO] 🗄️  Starting PostgreSQL to D1 migration...
[2024-01-15T02:45:20Z] [SUCCESS] ✓ PostgreSQL to D1 Migration completed in 1785.23s
[2024-01-15T02:45:25Z] [INFO] ⚡ Starting Redis to KV/Durable Objects migration...
[2024-01-15T02:50:10Z] [SUCCESS] ✓ Redis to KV Migration completed in 285.67s
[2024-01-15T02:50:15Z] [INFO] 🔍 Verifying data integrity...
[2024-01-15T02:55:00Z] [SUCCESS] ✓ S3 to R2: 1523 files verified
[2024-01-15T02:55:05Z] [SUCCESS] ✓ PostgreSQL to D1: 45678 rows verified
[2024-01-15T02:55:10Z] [SUCCESS] ✓ Redis to KV: 23 jobs verified
[2024-01-15T02:55:15Z] [INFO] 🧪 Testing application functionality...
[2024-01-15T02:56:00Z] [SUCCESS] ✓ File upload test passed
[2024-01-15T02:57:00Z] [SUCCESS] ✓ Job processing test passed
[2024-01-15T02:58:00Z] [SUCCESS] ✓ Database operations test passed
[2024-01-15T02:59:00Z] [SUCCESS] ✓ Deployment test passed
[2024-01-15T02:59:05Z] [INFO] 📊 Monitoring Cloudflare services performance...
[2024-01-15T03:00:00Z] [SUCCESS] ✅ Production migration completed successfully!
```

### Step 6: Verify Migration Results

Check the migration report:

```bash
cat logs/production-migration-report.json
```

The report includes:
- Migration ID and timestamps
- Status of each migration step
- Data verification results
- Application test results
- Any errors or warnings
- Rollback status

### Step 7: Post-Migration Verification

After migration completes, verify the application:

1. **Test File Upload**
   ```bash
   npx tsx scripts/test-file-upload.ts
   ```

2. **Test Job Processing**
   ```bash
   npx tsx scripts/test-job-processing.ts
   ```

3. **Test Database Operations**
   ```bash
   npx tsx scripts/test-database-operations.ts
   ```

4. **Test Deployment**
   ```bash
   npx tsx scripts/test-deployment.ts
   ```

5. **Manual Testing**
   - Upload a resume through the UI
   - Verify parsing works correctly
   - Customize and deploy a portfolio
   - Check that all features work as expected

### Step 8: Monitor for 7 Days

Keep AWS infrastructure running and monitor for:
- Application errors
- Performance issues
- Data inconsistencies
- User-reported problems

Check Cloudflare Analytics:
- R2 operation counts
- KV read/write operations
- D1 query performance
- Workers CPU time and memory usage

## Rollback Procedures

### Automatic Rollback

If `ENABLE_AUTO_ROLLBACK=true`, the migration will automatically rollback on failure:

```bash
ENABLE_AUTO_ROLLBACK=true ./scripts/production-migration.sh
```

### Manual Rollback

If you need to manually rollback:

1. **Rollback S3 to R2**
   ```bash
   npx tsx scripts/migrate-s3-to-r2.ts --rollback
   ```

2. **Rollback PostgreSQL to D1**
   ```bash
   npx tsx scripts/migrate-postgres-to-d1.ts --rollback
   ```

3. **Rollback Redis to KV**
   ```bash
   npx tsx scripts/rollback-redis-to-kv.ts
   ```

4. **Switch DNS back to AWS**
   - Update DNS records to point to AWS infrastructure
   - Verify application is working on AWS

5. **Investigate Issues**
   - Review migration logs
   - Identify root cause
   - Fix issues before retrying

## Troubleshooting

### Migration Fails with "Missing Environment Variables"

**Solution**: Verify all required environment variables are set:
```bash
./scripts/pre-deployment-check.sh
```

### S3 to R2 Migration Fails with Checksum Mismatch

**Solution**: 
- Check network connectivity
- Verify R2 bucket permissions
- Retry the migration (it will resume from checkpoint)

### PostgreSQL to D1 Migration Fails with Foreign Key Violations

**Solution**:
- Verify D1 schema matches PostgreSQL schema
- Check that all tables are migrated in correct order
- Review referential integrity constraints

### Redis to KV Migration Fails

**Solution**:
- Verify KV namespace ID is correct
- Check Cloudflare API token permissions
- Ensure Worker is deployed and accessible

### Application Tests Fail After Migration

**Solution**:
- Check Cloudflare service status
- Verify all bindings are configured correctly
- Review application logs for specific errors
- Test individual services (R2, D1, KV, DO) separately

### Data Count Mismatch

**Solution**:
- Review migration logs for failed transfers
- Check for partial failures
- Re-run migration for failed items only
- Verify source data hasn't changed during migration

## Performance Optimization

### During Migration

- Increase `PARALLEL_TRANSFERS` for faster S3 to R2 migration
- Increase `BATCH_SIZE` for faster D1 imports
- Run migration during low-traffic hours
- Monitor network bandwidth usage

### After Migration

- Enable KV caching for frequently accessed data
- Use D1 batch API for bulk operations
- Optimize Durable Objects for coordination only
- Serve static files directly from R2
- Monitor and optimize slow queries

## Monitoring and Alerts

### Cloudflare Analytics

Monitor these metrics:
- R2: Operation counts, bandwidth, storage
- KV: Read/write operations, quota usage
- D1: Query performance, row counts
- Workers: CPU time, memory usage, error rate

### Custom Monitoring

Set up alerts for:
- Migration failures
- Data verification failures
- Application test failures
- High error rates
- Performance degradation
- Quota limits approaching

## Next Steps

After successful migration and 7-day monitoring period:

1. **Verify Stability**
   - No errors reported
   - Performance is acceptable
   - All features working correctly

2. **Create Final Backup**
   - Backup AWS S3 data
   - Export PostgreSQL database
   - Export Redis data

3. **Decommission AWS Infrastructure**
   - Run task 15 to decommission AWS resources
   - Delete S3 bucket
   - Terminate PostgreSQL instance
   - Terminate Redis instance
   - Remove AWS credentials

4. **Update Documentation**
   - Update deployment guides
   - Update architecture diagrams
   - Update runbooks
   - Update team documentation

## Support

If you encounter issues during migration:

1. Check the migration logs in `logs/` directory
2. Review the migration report JSON file
3. Consult the troubleshooting section above
4. Check Cloudflare status page
5. Contact Cloudflare support if needed

## Appendix

### Migration Script Options

```bash
# Dry run (no actual migration)
npx tsx scripts/production-migration.ts --dry-run

# Skip specific migrations
RUN_S3_MIGRATION=false ./scripts/production-migration.sh
RUN_POSTGRESQL_MIGRATION=false ./scripts/production-migration.sh
RUN_REDIS_MIGRATION=false ./scripts/production-migration.sh

# Disable verification
VERIFY_DATA_INTEGRITY=false ./scripts/production-migration.sh
TEST_APPLICATION=false ./scripts/production-migration.sh

# Enable aggressive rollback
ROLLBACK_ON_ANY_ERROR=true ./scripts/production-migration.sh
```

### Checkpoint Files

Migration scripts create checkpoint files for resume capability:
- `logs/s3-to-r2-checkpoint.json`
- `logs/postgres-to-d1-checkpoint.json`
- `logs/redis-to-kv-checkpoint.json`

These allow migrations to resume from the last successful point if interrupted.

### Log Files

All migration logs are stored in the `logs/` directory:
- `logs/s3-to-r2-migration.log`
- `logs/postgres-to-d1-migration.log`
- `logs/redis-to-kv-migration.log`
- `logs/prod-migration-{timestamp}.log`
- `logs/production-migration-report.json`
