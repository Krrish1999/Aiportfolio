#!/bin/bash

###############################################################################
# Cloudflare Pages Deployment Script
# 
# This script automates the deployment process to Cloudflare Pages.
# It performs pre-deployment checks, builds the application, and deploys.
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
PROJECT_NAME="ai-resume-portfolio"
SKIP_CHECKS=${SKIP_CHECKS:-false}
SKIP_TESTS=${SKIP_TESTS:-false}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Cloudflare Pages Deployment Script                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "Project: ${GREEN}$PROJECT_NAME${NC}"
echo ""

###############################################################################
# Step 1: Pre-Deployment Checks
###############################################################################
if [ "$SKIP_CHECKS" = "false" ]; then
    echo -e "${BLUE}[1/6]${NC} Running pre-deployment checks..."
    
    if bash scripts/pre-deployment-check.sh; then
        echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"
    else
        echo -e "${RED}✗ Pre-deployment checks failed${NC}"
        echo ""
        echo "Fix the issues above and try again."
        echo "Or skip checks with: SKIP_CHECKS=true $0 $ENVIRONMENT"
        exit 1
    fi
else
    echo -e "${YELLOW}[1/6] Skipping pre-deployment checks${NC}"
fi

echo ""

###############################################################################
# Step 2: Run Tests
###############################################################################
if [ "$SKIP_TESTS" = "false" ]; then
    echo -e "${BLUE}[2/6]${NC} Running tests..."
    
    if npm run test:run; then
        echo -e "${GREEN}✓ All tests passed${NC}"
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        echo ""
        echo "Fix failing tests and try again."
        echo "Or skip tests with: SKIP_TESTS=true $0 $ENVIRONMENT"
        exit 1
    fi
else
    echo -e "${YELLOW}[2/6] Skipping tests${NC}"
fi

echo ""

###############################################################################
# Step 3: Build Application
###############################################################################
echo -e "${BLUE}[3/6]${NC} Building application..."

# Clean previous build
rm -rf .next

# Build Next.js application
if npm run build; then
    echo -e "${GREEN}✓ Build completed successfully${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo ""

###############################################################################
# Step 4: Prepare for Pages Deployment
###############################################################################
echo -e "${BLUE}[4/6]${NC} Preparing for Pages deployment..."

if npm run pages:prepare; then
    echo -e "${GREEN}✓ Pages preparation completed${NC}"
else
    echo -e "${RED}✗ Pages preparation failed${NC}"
    exit 1
fi

echo ""

###############################################################################
# Step 5: Deploy to Cloudflare Pages
###############################################################################
echo -e "${BLUE}[5/6]${NC} Deploying to Cloudflare Pages ($ENVIRONMENT)..."

if [ "$ENVIRONMENT" = "production" ]; then
    BRANCH="main"
    echo -e "${YELLOW}⚠️  Deploying to PRODUCTION${NC}"
    echo -e "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
    sleep 5
elif [ "$ENVIRONMENT" = "staging" ]; then
    BRANCH="staging"
else
    BRANCH="$ENVIRONMENT"
fi

# Deploy using Wrangler
if wrangler pages deploy .next \
    --project-name="$PROJECT_NAME" \
    --branch="$BRANCH" \
    --commit-dirty=true; then
    echo -e "${GREEN}✓ Deployment completed successfully${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

echo ""

###############################################################################
# Step 6: Get Deployment URL
###############################################################################
echo -e "${BLUE}[6/6]${NC} Getting deployment URL..."

# Get latest deployment
DEPLOYMENT_INFO=$(wrangler pages deployment list --project-name="$PROJECT_NAME" 2>&1 | head -n 10)

if echo "$DEPLOYMENT_INFO" | grep -q "https://"; then
    DEPLOYMENT_URL=$(echo "$DEPLOYMENT_INFO" | grep -o 'https://[^ ]*' | head -n 1)
    echo -e "${GREEN}✓ Deployment URL: $DEPLOYMENT_URL${NC}"
else
    echo -e "${YELLOW}⚠️  Could not extract deployment URL${NC}"
    DEPLOYMENT_URL="https://$PROJECT_NAME.pages.dev"
    echo -e "Default URL: $DEPLOYMENT_URL"
fi

echo ""

###############################################################################
# Summary
###############################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Deployment Summary                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "Project: ${GREEN}$PROJECT_NAME${NC}"
echo -e "Branch: ${GREEN}$BRANCH${NC}"
echo -e "URL: ${GREEN}$DEPLOYMENT_URL${NC}"
echo ""
echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo ""

###############################################################################
# Next Steps
###############################################################################
echo "Next steps:"
echo ""
echo "1. Verify deployment:"
echo "   export DEPLOYMENT_URL=\"$DEPLOYMENT_URL\""
echo "   npm run cf:verify"
echo ""
echo "2. View logs:"
echo "   wrangler tail"
echo ""
echo "3. Test manually:"
echo "   curl -I $DEPLOYMENT_URL"
echo "   curl $DEPLOYMENT_URL/api/status/test"
echo ""
echo "4. Monitor in dashboard:"
echo "   https://dash.cloudflare.com/?to=/:account/pages/view/$PROJECT_NAME"
echo ""

if [ "$ENVIRONMENT" = "staging" ]; then
    echo "5. Deploy to production when ready:"
    echo "   $0 production"
    echo ""
fi

echo "For troubleshooting, see: DEPLOYMENT_GUIDE.md"
echo ""
