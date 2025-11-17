#!/bin/bash

###############################################################################
# Pre-Deployment Check Script
# 
# This script verifies that all prerequisites are met before deploying to
# Cloudflare Pages. It checks:
# - Wrangler CLI installation and authentication
# - Required Cloudflare resources (R2, KV, D1)
# - Environment variables and secrets
# - Build configuration
# - Local tests passing
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Cloudflare Pages Pre-Deployment Check             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print check result
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((CHECKS_WARNING++))
}

###############################################################################
# 1. Check Wrangler CLI
###############################################################################
echo -e "${BLUE}[1/10]${NC} Checking Wrangler CLI..."

if command -v wrangler &> /dev/null; then
    WRANGLER_VERSION=$(wrangler --version)
    check_pass "Wrangler CLI installed: $WRANGLER_VERSION"
else
    check_fail "Wrangler CLI not installed. Run: npm install -g wrangler"
fi

# Check Wrangler authentication
if wrangler whoami &> /dev/null; then
    WRANGLER_USER=$(wrangler whoami 2>&1 | grep "You are logged in" || echo "Unknown")
    check_pass "Wrangler authenticated: $WRANGLER_USER"
else
    check_fail "Wrangler not authenticated. Run: wrangler login"
fi

echo ""

###############################################################################
# 2. Check Cloudflare Account Configuration
###############################################################################
echo -e "${BLUE}[2/10]${NC} Checking Cloudflare account configuration..."

if [ -f "wrangler.toml" ]; then
    check_pass "wrangler.toml exists"
    
    # Check if account_id is set
    if grep -q "account_id = \"your-cloudflare-account-id\"" wrangler.toml; then
        check_fail "account_id not configured in wrangler.toml"
    else
        check_pass "account_id configured in wrangler.toml"
    fi
else
    check_fail "wrangler.toml not found"
fi

echo ""

###############################################################################
# 3. Check R2 Bucket
###############################################################################
echo -e "${BLUE}[3/10]${NC} Checking R2 bucket..."

if wrangler r2 bucket list &> /dev/null; then
    if wrangler r2 bucket list 2>&1 | grep -q "ai-resume-storage"; then
        check_pass "R2 bucket 'ai-resume-storage' exists"
    else
        check_fail "R2 bucket 'ai-resume-storage' not found. Run: wrangler r2 bucket create ai-resume-storage"
    fi
else
    check_fail "Unable to list R2 buckets. Check authentication and permissions."
fi

echo ""

###############################################################################
# 4. Check KV Namespace
###############################################################################
echo -e "${BLUE}[4/10]${NC} Checking KV namespace..."

if wrangler kv:namespace list &> /dev/null; then
    if wrangler kv:namespace list 2>&1 | grep -q "RESUME_CACHE"; then
        check_pass "KV namespace 'RESUME_CACHE' exists"
    else
        check_warn "KV namespace 'RESUME_CACHE' not found. Run: wrangler kv:namespace create RESUME_CACHE"
    fi
    
    # Check if KV ID is configured
    if grep -q "id = \"your-kv-namespace-id\"" wrangler.toml; then
        check_fail "KV namespace ID not configured in wrangler.toml"
    else
        check_pass "KV namespace ID configured in wrangler.toml"
    fi
else
    check_fail "Unable to list KV namespaces. Check authentication and permissions."
fi

echo ""

###############################################################################
# 5. Check D1 Database
###############################################################################
echo -e "${BLUE}[5/10]${NC} Checking D1 database..."

if wrangler d1 list &> /dev/null; then
    if wrangler d1 list 2>&1 | grep -q "ai-resume-db"; then
        check_pass "D1 database 'ai-resume-db' exists"
        
        # Check if migrations are applied
        TABLES=$(wrangler d1 execute ai-resume-db --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='table';" 2>&1 | grep -o '[0-9]\+' | head -1 || echo "0")
        if [ "$TABLES" -gt "0" ]; then
            check_pass "D1 database has $TABLES tables (migrations applied)"
        else
            check_warn "D1 database has no tables. Run migrations: bash scripts/apply-d1-migration.sh"
        fi
    else
        check_fail "D1 database 'ai-resume-db' not found. Run: wrangler d1 create ai-resume-db"
    fi
    
    # Check if D1 ID is configured
    if grep -q "database_id = \"your-d1-database-id\"" wrangler.toml; then
        check_fail "D1 database ID not configured in wrangler.toml"
    else
        check_pass "D1 database ID configured in wrangler.toml"
    fi
else
    check_fail "Unable to list D1 databases. Check authentication and permissions."
fi

echo ""

###############################################################################
# 6. Check Environment Variables
###############################################################################
echo -e "${BLUE}[6/10]${NC} Checking environment variables..."

REQUIRED_VARS=(
    "CLOUDFLARE_ACCOUNT_ID"
    "CLOUDFLARE_API_TOKEN"
    "OPENROUTER_API_KEY"
    "NEXTAUTH_SECRET"
)

for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        check_warn "Environment variable $VAR not set (should be configured as secret)"
    else
        check_pass "Environment variable $VAR is set"
    fi
done

echo ""

###############################################################################
# 7. Check Build Configuration
###############################################################################
echo -e "${BLUE}[7/10]${NC} Checking build configuration..."

if [ -f "next.config.js" ]; then
    check_pass "next.config.js exists"
else
    check_fail "next.config.js not found"
fi

if [ -f "_worker.js" ]; then
    check_pass "_worker.js exists"
else
    check_warn "_worker.js not found (optional for custom worker configuration)"
fi

if [ -f "package.json" ]; then
    check_pass "package.json exists"
    
    # Check for required scripts
    if grep -q "\"build:pages\"" package.json; then
        check_pass "build:pages script configured"
    else
        check_fail "build:pages script not found in package.json"
    fi
    
    if grep -q "\"cf:deploy\"" package.json; then
        check_pass "cf:deploy script configured"
    else
        check_fail "cf:deploy script not found in package.json"
    fi
else
    check_fail "package.json not found"
fi

echo ""

###############################################################################
# 8. Check Dependencies
###############################################################################
echo -e "${BLUE}[8/10]${NC} Checking dependencies..."

if [ -d "node_modules" ]; then
    check_pass "node_modules directory exists"
else
    check_fail "node_modules not found. Run: npm install"
fi

# Check for Cloudflare-specific packages
if [ -f "package.json" ]; then
    if grep -q "@cloudflare/workers-types" package.json; then
        check_pass "@cloudflare/workers-types installed"
    else
        check_warn "@cloudflare/workers-types not found (recommended for TypeScript support)"
    fi
    
    if grep -q "wrangler" package.json; then
        check_pass "wrangler installed as dev dependency"
    else
        check_warn "wrangler not in package.json (should be installed globally or as dev dependency)"
    fi
fi

echo ""

###############################################################################
# 9. Check Build Output
###############################################################################
echo -e "${BLUE}[9/10]${NC} Checking build output..."

if [ -d ".next" ]; then
    check_pass ".next directory exists"
    
    # Check for required files
    if [ -f ".next/_routes.json" ]; then
        check_pass "_routes.json exists in build output"
    else
        check_warn "_routes.json not found. Run: npm run pages:prepare"
    fi
    
    if [ -f ".next/_headers" ]; then
        check_pass "_headers exists in build output"
    else
        check_warn "_headers not found. Run: npm run pages:prepare"
    fi
else
    check_warn ".next directory not found. Run: npm run build"
fi

echo ""

###############################################################################
# 10. Check Tests
###############################################################################
echo -e "${BLUE}[10/10]${NC} Checking tests..."

if [ -f "vitest.config.mts" ]; then
    check_pass "vitest.config.mts exists"
    
    # Try to run tests (optional, can be slow)
    if [ "$RUN_TESTS" = "true" ]; then
        echo "Running tests..."
        if npm run test:run &> /dev/null; then
            check_pass "All tests passing"
        else
            check_fail "Some tests failing. Run: npm run test:run"
        fi
    else
        check_warn "Tests not run (set RUN_TESTS=true to run tests)"
    fi
else
    check_warn "vitest.config.mts not found (tests may not be configured)"
fi

echo ""

###############################################################################
# Summary
###############################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Check Summary                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))

echo -e "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
echo -e "${YELLOW}Warnings: $CHECKS_WARNING${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo ""
    echo "You can now deploy to Cloudflare Pages:"
    echo "  npm run cf:deploy:staging    # Deploy to staging"
    echo "  npm run cf:deploy:production # Deploy to production"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some critical checks failed.${NC}"
    echo ""
    echo "Please fix the issues above before deploying."
    echo ""
    echo "Common fixes:"
    echo "  - Run: wrangler login"
    echo "  - Run: npm run cf:setup"
    echo "  - Update wrangler.toml with correct IDs"
    echo "  - Run: npm install"
    echo "  - Run: npm run build"
    echo ""
    exit 1
fi
