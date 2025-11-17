#!/bin/bash

# Cloudflare Infrastructure Setup Script
# This script automates the creation of Cloudflare resources

set -e  # Exit on error

echo "🚀 Cloudflare Infrastructure Setup"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js version
echo "📋 Checking prerequisites..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Error: Node.js v20.0.0 or higher required${NC}"
    echo "Current version: $(node --version)"
    echo "Please upgrade Node.js: nvm install 20 && nvm use 20"
    exit 1
fi
echo -e "${GREEN}✅ Node.js version OK: $(node --version)${NC}"

# Check if Wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found${NC}"
    echo "Installing Wrangler globally..."
    npm install -g wrangler
fi
echo -e "${GREEN}✅ Wrangler installed: $(wrangler --version)${NC}"

# Check authentication
echo ""
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with Cloudflare${NC}"
    echo "Opening browser for authentication..."
    wrangler login
else
    echo -e "${GREEN}✅ Already authenticated${NC}"
    wrangler whoami
fi

# Get account ID
echo ""
echo "📝 Getting account information..."
ACCOUNT_INFO=$(wrangler whoami 2>&1)
echo "$ACCOUNT_INFO"

# Prompt for account ID if not in wrangler.toml
echo ""
read -p "Enter your Cloudflare Account ID: " ACCOUNT_ID

if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Account ID is required${NC}"
    exit 1
fi

# Update wrangler.toml with account ID
echo ""
echo "📝 Updating wrangler.toml with account ID..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/account_id = \"your-cloudflare-account-id\"/account_id = \"$ACCOUNT_ID\"/" wrangler.toml
else
    # Linux
    sed -i "s/account_id = \"your-cloudflare-account-id\"/account_id = \"$ACCOUNT_ID\"/" wrangler.toml
fi
echo -e "${GREEN}✅ Account ID updated in wrangler.toml${NC}"

# Create R2 buckets
echo ""
echo "📦 Creating R2 buckets..."
if wrangler r2 bucket create ai-resume-storage 2>&1 | grep -q "already exists\|Created"; then
    echo -e "${GREEN}✅ Production bucket: ai-resume-storage${NC}"
else
    echo -e "${RED}❌ Failed to create production bucket${NC}"
fi

if wrangler r2 bucket create ai-resume-storage-preview 2>&1 | grep -q "already exists\|Created"; then
    echo -e "${GREEN}✅ Preview bucket: ai-resume-storage-preview${NC}"
else
    echo -e "${RED}❌ Failed to create preview bucket${NC}"
fi

# Create KV namespaces
echo ""
echo "🗄️  Creating KV namespaces..."
echo "Creating production namespace..."
KV_OUTPUT=$(wrangler kv:namespace create RESUME_CACHE 2>&1)
echo "$KV_OUTPUT"

if echo "$KV_OUTPUT" | grep -q "id = "; then
    KV_ID=$(echo "$KV_OUTPUT" | grep "id = " | sed 's/.*id = "\(.*\)".*/\1/')
    echo -e "${GREEN}✅ Production KV namespace ID: $KV_ID${NC}"
    
    # Update wrangler.toml
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/id = \"your-kv-namespace-id\"/id = \"$KV_ID\"/" wrangler.toml
    else
        sed -i "s/id = \"your-kv-namespace-id\"/id = \"$KV_ID\"/" wrangler.toml
    fi
fi

echo "Creating preview namespace..."
KV_PREVIEW_OUTPUT=$(wrangler kv:namespace create RESUME_CACHE --preview 2>&1)
echo "$KV_PREVIEW_OUTPUT"

if echo "$KV_PREVIEW_OUTPUT" | grep -q "preview_id = "; then
    KV_PREVIEW_ID=$(echo "$KV_PREVIEW_OUTPUT" | grep "preview_id = " | sed 's/.*preview_id = "\(.*\)".*/\1/')
    echo -e "${GREEN}✅ Preview KV namespace ID: $KV_PREVIEW_ID${NC}"
    
    # Update wrangler.toml
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/preview_id = \"your-preview-kv-namespace-id\"/preview_id = \"$KV_PREVIEW_ID\"/" wrangler.toml
    else
        sed -i "s/preview_id = \"your-preview-kv-namespace-id\"/preview_id = \"$KV_PREVIEW_ID\"/" wrangler.toml
    fi
fi

# Create D1 database
echo ""
echo "🗃️  Creating D1 database..."
D1_OUTPUT=$(wrangler d1 create ai-resume-db 2>&1)
echo "$D1_OUTPUT"

if echo "$D1_OUTPUT" | grep -q "database_id"; then
    D1_ID=$(echo "$D1_OUTPUT" | grep "database_id" | sed 's/.*database_id = "\(.*\)".*/\1/' | tr -d ' ')
    echo -e "${GREEN}✅ D1 database ID: $D1_ID${NC}"
    
    # Update wrangler.toml
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/database_id = \"your-d1-database-id\"/database_id = \"$D1_ID\"/" wrangler.toml
    else
        sed -i "s/database_id = \"your-d1-database-id\"/database_id = \"$D1_ID\"/" wrangler.toml
    fi
fi

# Test D1 connection
echo ""
echo "🧪 Testing D1 database connection..."
if wrangler d1 execute ai-resume-db --command "SELECT datetime('now') as current_time" 2>&1 | grep -q "current_time"; then
    echo -e "${GREEN}✅ D1 database is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify D1 connection${NC}"
fi

# Summary
echo ""
echo "======================================"
echo "✨ Setup Complete!"
echo "======================================"
echo ""
echo "📋 Next Steps:"
echo "1. Update your .env file with Cloudflare credentials"
echo "2. Set secrets using: wrangler secret put SECRET_NAME"
echo "3. Test local development: wrangler dev --local"
echo "4. Review CLOUDFLARE_SETUP.md for detailed instructions"
echo ""
echo "🔑 Required Secrets to Set:"
echo "   - wrangler secret put OPENROUTER_API_KEY"
echo "   - wrangler secret put GITHUB_CLIENT_SECRET"
echo "   - wrangler secret put LINKEDIN_CLIENT_SECRET"
echo "   - wrangler secret put NEXTAUTH_SECRET"
echo "   - wrangler secret put CLOUDFLARE_API_TOKEN"
echo ""
echo "📚 Resources:"
echo "   - Setup Guide: ./CLOUDFLARE_SETUP.md"
echo "   - Wrangler Config: ./wrangler.toml"
echo "   - Environment Variables: ./.env.example"
echo ""
