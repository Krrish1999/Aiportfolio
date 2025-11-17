#!/bin/bash

# Redis to KV/Durable Objects Migration Script Wrapper

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Redis to KV Migration Script        ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create a .env file with the following variables:"
    echo "  REDIS_HOST"
    echo "  REDIS_PORT"
    echo "  REDIS_PASSWORD (optional)"
    echo "  CLOUDFLARE_ACCOUNT_ID"
    echo "  CLOUDFLARE_API_TOKEN"
    echo "  KV_NAMESPACE_ID"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check required variables
REQUIRED_VARS=(
    "CLOUDFLARE_ACCOUNT_ID"
    "CLOUDFLARE_API_TOKEN"
    "KV_NAMESPACE_ID"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    exit 1
fi

# Create directories
mkdir -p logs
mkdir -p migration-data

# Display configuration
echo -e "${GREEN}Configuration:${NC}"
echo "  Source: Redis ${REDIS_HOST:-localhost}:${REDIS_PORT:-6379}"
echo "  Target: KV Namespace ${KV_NAMESPACE_ID}"
echo "  Worker: ${WORKER_NAME:-ai-resume-portfolio}"
echo "  Verify Jobs: ${VERIFY_JOBS:-true}"
echo ""

# Warning
echo -e "${YELLOW}⚠️  NOTE:${NC}"
echo "  This will export active job states from Redis and import to KV."
echo "  Active jobs will be recreated in Durable Objects."
echo "  Make sure:"
echo "  1. Your Workers are deployed and accessible"
echo "  2. Redis is accessible and contains job data"
echo "  3. You have tested on a staging environment"
echo ""

# Confirm before proceeding
read -p "Do you want to proceed with the migration? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Starting migration...${NC}"
echo ""

# Run the TypeScript migration script
npx tsx scripts/migrate-redis-to-kv.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Verify jobs in KV using Cloudflare dashboard"
    echo "  2. Check migration summary: cat migration-data/redis-migration-summary.json"
    echo "  3. Test job processing with Durable Objects"
    echo "  4. Monitor for any errors in Workers logs"
    echo "  5. Keep Redis running for rollback capability"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Migration failed. Check logs/redis-to-kv-migration.log for details.${NC}"
    echo ""
    exit 1
fi
