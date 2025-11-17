# Migration Scripts Testing Guide

This guide provides comprehensive instructions for testing the data migration scripts before running them in production.

## Overview

The testing suite validates all three migration scripts:
1. **S3 to R2 Migration** - File storage migration
2. **PostgreSQL to D1 Migration** - Database migration
3. **Redis to KV Migration** - Job queue migration

## Quick Start

Run the complete test suite:

```bash
# Make script executable
chmod +x scripts/test-migrations.sh

# Run tests
./scripts/test-migrations.sh
```

Or run directly with TypeScript:

```bash
npx tsx scripts/test-migrations.ts
```

## Test Suite Components

### 1. Sample Data Generation

The test suite automatically generates realistic sample data:

#### S3 Sample Data
- 5 sample files (PDFs, DOCX, images, archives)
- Various file sizes (50KB - 500KB)
- Metadata with checksums
- Located in: `test-data/s3-sample/`

#### PostgreSQL Sample Data
- 3 users
- 2 resume sessions
- 1 portfolio
- 2 parsing metrics
- JSON and SQL formats
- Located in: `test-data/postgresql-sample/`

#### Redis Sample Data
- 3 job states (completed, processing, failed)
- Bull queue format
- Job metadata and progress
- Located in: `test-data/redis-sample/`

### 2. Test Cases

The suite runs the following tests:

#### Test 1: Sample Data Generation
- Creates sample datasets for all three migration types
- Verifies directory structure
- Generates metadata files

#### Test 2: Data Integrity Verification
- Validates checksums for S3 files
- Verifies PostgreSQL data structure
- Checks Redis job format
- Ensures row counts match expectations

#### Test 3: Migration Scripts Syntax
- TypeScript syntax validation
- Checks for compilation errors
- Verifies all scripts are executable

#### Test 4: Rollback Mechanisms
- Verifies rollback functions exist
- Checks error handling
- Validates cleanup procedures

#### Test 5: Migration Documentation
- Checks MIGRATION_GUIDE.md exists
- Verifies required sections present
- Ensures all scripts documented

#### Test 6: Environment Variables
- Validates environment variable checks
- Verifies required fields validation
- Checks error handling for missing vars

#### Test 7: Logging and Progress
- Verifies logging functionality
- Checks progress tracking
- Validates summary generation

## Test Results

### Test Report

After running tests, view the detailed report:

```bash
cat logs/migration-test-report.json
```

The report includes:
- Total tests run
- Pass/fail counts
- Individual test results
- Error messages for failures
- Execution times

### Sample Output

```json
{
  "startTime": "2024-01-15T10:00:00.000Z",
  "endTime": "2024-01-15T10:00:05.000Z",
  "totalTests": 7,
  "passedTests": 7,
  "failedTests": 0,
  "results": [
    {
      "testName": "Sample Data Generation",
      "success": true,
      "duration": 234,
      "details": "Test passed successfully"
    }
  ]
}
```

## Manual Testing with Sample Data

After the automated tests pass, you can manually test the migration scripts with the generated sample data.

### Testing S3 to R2 Migration

1. **Setup local S3 (MinIO)**

```bash
# Install MinIO (macOS)
brew install minio/stable/minio

# Start MinIO server
minio server ~/minio-data

# Create bucket and upload sample files
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/test-bucket
mc cp test-data/s3-sample/* local/test-bucket/
```

2. **Configure environment**

```bash
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export AWS_REGION=us-east-1
export S3_BUCKET_NAME=test-bucket
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export R2_ACCESS_KEY_ID=your-r2-key
export R2_SECRET_ACCESS_KEY=your-r2-secret
export R2_BUCKET_NAME=test-r2-bucket
```

3. **Run migration**

```bash
npx tsx scripts/migrate-s3-to-r2.ts
```

4. **Verify results**

```bash
# Check R2 bucket
wrangler r2 object list test-r2-bucket

# Verify checksums
cat logs/s3-to-r2-checkpoint.json
```

### Testing PostgreSQL to D1 Migration

1. **Setup local PostgreSQL**

```bash
# Install PostgreSQL (macOS)
brew install postgresql@15

# Start PostgreSQL
brew services start postgresql@15

# Create test database
createdb test_migration_db

# Apply schema
psql test_migration_db < prisma/migrations/d1_initial_migration.sql

# Load sample data
psql test_migration_db < test-data/postgresql-sample/sample-data.sql
```

2. **Configure environment**

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=test_migration_db
export POSTGRES_USER=your-username
export POSTGRES_PASSWORD=your-password
export D1_DATABASE_NAME=test-d1-db
```

3. **Create D1 database**

```bash
# Create local D1 database
wrangler d1 create test-d1-db --local

# Apply migrations
wrangler d1 execute test-d1-db --file=prisma/migrations/d1_initial_migration.sql --local
```

4. **Run migration**

```bash
npx tsx scripts/migrate-postgres-to-d1.ts
```

5. **Verify results**

```bash
# Check row counts
wrangler d1 execute test-d1-db --command="SELECT COUNT(*) FROM users" --local
wrangler d1 execute test-d1-db --command="SELECT COUNT(*) FROM resume_sessions" --local

# View sample data
wrangler d1 execute test-d1-db --command="SELECT * FROM users LIMIT 5" --local

# Check migration summary
cat migration-data/migration-summary.json
```

### Testing Redis to KV Migration

1. **Setup local Redis**

```bash
# Install Redis (macOS)
brew install redis

# Start Redis
brew services start redis

# Load sample job data (requires custom script or manual insertion)
redis-cli
> HSET bull:resume-processing:job-001 data '{"sessionId":"650e8400-e29b-41d4-a716-446655440001"}'
```

2. **Configure environment**

```bash
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_DB=0
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export CLOUDFLARE_API_TOKEN=your-api-token
export KV_NAMESPACE_ID=your-kv-namespace-id
export WORKER_NAME=test-worker
```

3. **Run migration**

```bash
npx tsx scripts/migrate-redis-to-kv.ts
```

4. **Verify results**

```bash
# Check KV namespace
wrangler kv:key list --namespace-id=your-kv-namespace-id

# View specific job
wrangler kv:key get "job:job-001" --namespace-id=your-kv-namespace-id

# Check migration summary
cat migration-data/redis-migration-summary.json
```

## Testing Rollback Mechanisms

### S3 to R2 Rollback

```bash
# Enable rollback on error
export ROLLBACK_ON_ERROR=true

# Trigger a failure (e.g., invalid credentials)
export R2_ACCESS_KEY_ID=invalid-key
npx tsx scripts/migrate-s3-to-r2.ts

# Verify rollback occurred
wrangler r2 object list test-r2-bucket
# Should be empty or unchanged
```

### PostgreSQL to D1 Rollback

```bash
# Enable rollback on error
export ROLLBACK_ON_ERROR=true

# Trigger a failure (e.g., invalid database)
export D1_DATABASE_NAME=nonexistent-db
npx tsx scripts/migrate-postgres-to-d1.ts

# Verify rollback occurred
wrangler d1 execute test-d1-db --command="SELECT COUNT(*) FROM users" --local
# Should return 0 or original count
```

## Continuous Integration Testing

### GitHub Actions Example

```yaml
name: Test Migration Scripts

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migration tests
        run: npx tsx scripts/test-migrations.ts
      
      - name: Upload test report
        uses: actions/upload-artifact@v3
        with:
          name: test-report
          path: logs/migration-test-report.json
```

## Troubleshooting

### Test Failures

#### "Sample data directories not created"
- Check write permissions in project directory
- Ensure sufficient disk space
- Verify Node.js has file system access

#### "TypeScript syntax error"
- Run `npm install` to ensure dependencies are installed
- Check TypeScript version: `npx tsc --version`
- Verify tsconfig.json is present

#### "Migration script not found"
- Ensure you're running from project root
- Check that all migration scripts exist in `scripts/` directory
- Verify file permissions

### Performance Issues

If tests run slowly:
- Reduce sample data size in `test-migrations.ts`
- Skip checksum verification: `export VERIFY_CHECKSUMS=false`
- Use SSD for test data directory

### Cleanup Issues

If test data isn't cleaned up:
- Manually remove: `rm -rf test-data/`
- Check `CLEANUP_TEST_DATA` environment variable
- Verify write permissions

## Best Practices

### Before Production Migration

1. ✅ Run automated test suite
2. ✅ Test with sample data locally
3. ✅ Test on staging environment
4. ✅ Verify rollback mechanisms
5. ✅ Document any issues found
6. ✅ Review test reports
7. ✅ Get team approval

### During Testing

- Keep test data separate from production
- Use dedicated test credentials
- Monitor resource usage
- Log all test runs
- Document unexpected behavior

### After Testing

- Archive test reports
- Clean up test resources
- Update documentation
- Share findings with team
- Plan production migration

## Configuration Options

### Environment Variables

```bash
# Test configuration
CLEANUP_TEST_DATA=true          # Clean up after tests (default: true)

# Migration settings (for manual testing)
PARALLEL_TRANSFERS=5            # S3 to R2 parallel transfers
BATCH_SIZE=100                  # PostgreSQL batch size
VERIFY_CHECKSUMS=true           # Verify file checksums
VERIFY_DATA=true                # Verify data integrity
VERIFY_JOBS=true                # Verify job migration
ROLLBACK_ON_ERROR=false         # Auto-rollback on error
```

## Support

For issues or questions:

1. Check test report: `logs/migration-test-report.json`
2. Review logs: `logs/`
3. Consult MIGRATION_GUIDE.md
4. Check sample data: `test-data/`

## References

- [Migration Guide](./MIGRATION_GUIDE.md)
- [S3 to R2 Migration Script](./migrate-s3-to-r2.ts)
- [PostgreSQL to D1 Migration Script](./migrate-postgres-to-d1.ts)
- [Redis to KV Migration Script](./migrate-redis-to-kv.ts)
