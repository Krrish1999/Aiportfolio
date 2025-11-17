#!/bin/bash

# S3 to R2 Migration Script Wrapper
# This script provides a convenient way to run the TypeScript migration script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   S3 to R2 Migration Script           ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create a .env file with the following variables:"
    echo "  AWS_ACCESS_KEY_ID"
    echo "  AWS_SECRET_ACCESS_KEY"
    echo "  AWS_REGION"
    echo "  S3_BUCKET_NAME"
    echo "  CLOUDFLARE_ACCOUNT_ID"
    echo "  R2_ACCESS_KEY_ID"
    echo "  R2_SECRET_ACCESS_KEY"
    echo "  R2_BUCKET_NAME"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check required variables
REQUIRED_VARS=(
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "S3_BUCKET_NAME"
    "CLOUDFLARE_ACCOUNT_ID"
    "R2_ACCESS_KEY_ID"
    "R2_SECRET_ACCESS_KEY"
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

# Create logs directory
mkdir -p logs

# Display configuration
echo -e "${GREEN}Configuration:${NC}"
echo "  Source: s3://${S3_BUCKET_NAME}"
echo "  Target: r2://${R2_BUCKET_NAME:-ai-resume-storage}"
echo "  Parallel Transfers: ${PARALLEL_TRANSFERS:-5}"
echo "  Verify Checksums: ${VERIFY_CHECKSUMS:-true}"
echo "  Rollback on Error: ${ROLLBACK_ON_ERROR:-false}"
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
npx tsx scripts/migrate-s3-to-r2.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Verify data integrity in R2"
    echo "  2. Update application to use R2"
    echo "  3. Test application functionality"
    echo "  4. Keep S3 bucket for rollback capability"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Migration failed. Check logs/s3-to-r2-migration.log for details.${NC}"
    echo ""
    exit 1
fi
