#!/bin/bash

# PostgreSQL to D1 Migration Script Wrapper

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   PostgreSQL to D1 Migration Script   ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create a .env file with the following variables:"
    echo "  POSTGRES_HOST"
    echo "  POSTGRES_PORT"
    echo "  POSTGRES_DB"
    echo "  POSTGRES_USER"
    echo "  POSTGRES_PASSWORD"
    echo "  D1_DATABASE_NAME"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check required variables
REQUIRED_VARS=(
    "POSTGRES_DB"
    "POSTGRES_USER"
    "POSTGRES_PASSWORD"
    "D1_DATABASE_NAME"
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

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found${NC}"
    echo "Please install: npm install -g wrangler"
    exit 1
fi

# Create directories
mkdir -p logs
mkdir -p migration-data

# Display configuration
echo -e "${GREEN}Configuration:${NC}"
echo "  Source: PostgreSQL ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}/${POSTGRES_DB}"
echo "  Target: D1 Database ${D1_DATABASE_NAME}"
echo "  Batch Size: ${BATCH_SIZE:-100}"
echo "  Verify Data: ${VERIFY_DATA:-true}"
echo "  Rollback on Error: ${ROLLBACK_ON_ERROR:-false}"
echo ""

# Warning
echo -e "${YELLOW}⚠️  WARNING:${NC}"
echo "  This will export all data from PostgreSQL and import to D1."
echo "  Make sure you have:"
echo "  1. Applied D1 migrations (run scripts/apply-d1-migration.sh)"
echo "  2. Backed up your PostgreSQL database"
echo "  3. Tested the migration on a staging environment"
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
npx tsx scripts/migrate-postgres-to-d1.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Verify data in D1: wrangler d1 execute ${D1_DATABASE_NAME} --command='SELECT * FROM users LIMIT 5' --local"
    echo "  2. Check migration summary: cat migration-data/migration-summary.json"
    echo "  3. Test application with D1"
    echo "  4. Keep PostgreSQL for rollback capability"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Migration failed. Check logs/postgres-to-d1-migration.log for details.${NC}"
    echo ""
    exit 1
fi
