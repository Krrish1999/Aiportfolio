#!/bin/bash

# Production Migration Script
# Orchestrates the complete migration from AWS to Cloudflare

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in production
if [ "$ENVIRONMENT" != "production" ]; then
    log_warn "ENVIRONMENT is not set to 'production'"
    log_warn "Set ENVIRONMENT=production to proceed"
    exit 1
fi

# Pre-flight checks
log_info "Running pre-flight checks..."

# Check required environment variables
REQUIRED_VARS=(
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "S3_BUCKET_NAME"
    "POSTGRES_HOST"
    "POSTGRES_DB"
    "POSTGRES_USER"
    "POSTGRES_PASSWORD"
    "REDIS_HOST"
    "CLOUDFLARE_ACCOUNT_ID"
    "CLOUDFLARE_API_TOKEN"
    "R2_ACCESS_KEY_ID"
    "R2_SECRET_ACCESS_KEY"
    "KV_NAMESPACE_ID"
    "D1_DATABASE_NAME"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    log_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

log_success "All required environment variables are set"

# Check if migration scripts exist
log_info "Checking migration scripts..."
SCRIPTS=(
    "scripts/migrate-s3-to-r2.ts"
    "scripts/migrate-postgres-to-d1.ts"
    "scripts/migrate-redis-to-kv.ts"
    "scripts/production-migration.ts"
)

for script in "${SCRIPTS[@]}"; do
    if [ ! -f "$script" ]; then
        log_error "Migration script not found: $script"
        exit 1
    fi
done

log_success "All migration scripts found"

# Check Wrangler CLI
log_info "Checking Wrangler CLI..."
if ! command -v wrangler &> /dev/null; then
    log_error "Wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
fi

log_success "Wrangler CLI is installed"

# Check database connectivity
log_info "Testing database connectivity..."

# Test PostgreSQL
if command -v psql &> /dev/null; then
    if PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1" &> /dev/null; then
        log_success "PostgreSQL connection successful"
    else
        log_error "Failed to connect to PostgreSQL"
        exit 1
    fi
else
    log_warn "psql not found, skipping PostgreSQL connectivity test"
fi

# Test Redis
if command -v redis-cli &> /dev/null; then
    if redis-cli -h $REDIS_HOST ping &> /dev/null; then
        log_success "Redis connection successful"
    else
        log_error "Failed to connect to Redis"
        exit 1
    fi
else
    log_warn "redis-cli not found, skipping Redis connectivity test"
fi

# Display migration plan
echo ""
log_info "=========================================="
log_info "PRODUCTION MIGRATION PLAN"
log_info "=========================================="
echo ""
log_info "Maintenance Window:"
log_info "  Start: ${MAINTENANCE_START:-Immediately}"
log_info "  Duration: ${MAINTENANCE_DURATION:-120} minutes"
echo ""
log_info "Migrations to run:"
log_info "  - S3 to R2: ${RUN_S3_MIGRATION:-true}"
log_info "  - PostgreSQL to D1: ${RUN_POSTGRESQL_MIGRATION:-true}"
log_info "  - Redis to KV: ${RUN_REDIS_MIGRATION:-true}"
echo ""
log_info "Verification:"
log_info "  - Data Integrity: ${VERIFY_DATA_INTEGRITY:-true}"
log_info "  - Application Tests: ${TEST_APPLICATION:-true}"
echo ""
log_info "Rollback:"
log_info "  - Auto Rollback: ${ENABLE_AUTO_ROLLBACK:-false}"
log_info "  - Rollback on Any Error: ${ROLLBACK_ON_ANY_ERROR:-false}"
echo ""
log_info "=========================================="
echo ""

# Confirmation prompt
if [ "$SKIP_CONFIRMATION" != "true" ]; then
    log_warn "This will start the PRODUCTION MIGRATION"
    log_warn "AWS infrastructure will remain active for rollback capability"
    echo ""
    read -p "Are you sure you want to proceed? (type 'yes' to continue): " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        log_info "Migration cancelled"
        exit 0
    fi
fi

# Create logs directory
mkdir -p logs

# Run the migration
log_info "Starting production migration..."
echo ""

npx tsx scripts/production-migration.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    log_success "=========================================="
    log_success "PRODUCTION MIGRATION COMPLETED"
    log_success "=========================================="
    echo ""
    log_info "Next steps:"
    log_info "  1. Monitor application for errors and performance"
    log_info "  2. Check Cloudflare Analytics dashboard"
    log_info "  3. Verify all functionality is working correctly"
    log_info "  4. Keep AWS infrastructure running for 7 days"
    log_info "  5. After verification, run task 15 to decommission AWS"
    echo ""
    log_info "Report location: logs/production-migration-report.json"
else
    echo ""
    log_error "=========================================="
    log_error "PRODUCTION MIGRATION FAILED"
    log_error "=========================================="
    echo ""
    log_error "Check the logs for details"
    log_error "AWS infrastructure remains active"
    
    if [ "$ENABLE_AUTO_ROLLBACK" == "true" ]; then
        log_info "Auto-rollback was enabled - changes have been reverted"
    else
        log_warn "Manual rollback may be required"
    fi
    
    exit 1
fi
