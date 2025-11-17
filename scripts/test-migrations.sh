#!/bin/bash

# Migration Scripts Test Suite Wrapper
# This script runs comprehensive tests on all migration scripts

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Migration Scripts Test Suite        ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "Please install Node.js v20.0.0 or higher"
    exit 1
fi

# Check if TypeScript is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx not found${NC}"
    echo "Please install npm"
    exit 1
fi

# Create logs directory
mkdir -p logs

echo -e "${GREEN}Test Configuration:${NC}"
echo "  Test Data Directory: test-data/"
echo "  Test Logs Directory: logs/"
echo "  Test Report: logs/migration-test-report.json"
echo "  Cleanup After Test: ${CLEANUP_TEST_DATA:-true}"
echo ""

echo -e "${YELLOW}Running test suite...${NC}"
echo ""

# Run the TypeScript test script
npx tsx scripts/test-migrations.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "📋 Test Report:"
    echo "  View detailed results: cat logs/migration-test-report.json"
    echo ""
    echo "📁 Sample Data:"
    echo "  S3 samples: test-data/s3-sample/"
    echo "  PostgreSQL samples: test-data/postgresql-sample/"
    echo "  Redis samples: test-data/redis-sample/"
    echo ""
    echo "🔍 Next Steps:"
    echo "  1. Review the test report for detailed results"
    echo "  2. Inspect sample data files in test-data/"
    echo "  3. Run migration scripts with sample data (optional)"
    echo "  4. Test rollback mechanisms (optional)"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Some tests failed.${NC}"
    echo ""
    echo "Check logs/migration-test-report.json for details"
    echo ""
    exit 1
fi
