# Cloudflare Infrastructure Setup Guide

This guide walks you through setting up the Cloudflare infrastructure for the AI Resume-to-Portfolio application.

## Prerequisites

1. **Node.js v20.0.0 or higher** (Wrangler requirement)
   ```bash
   # Check your Node.js version
   node --version
   
   # If using nvm, upgrade to Node.js 20+
   nvm install 20
   nvm use 20
   ```

2. **Cloudflare Account**
   - Sign up at https://dash.cloudflare.com/sign-up
   - Free tier includes generous limits for R2, KV, D1, and Workers

3. **Wrangler CLI** (already installed)
   ```bash
   # Verify installation
   wrangler --version
   ```

## Step 1: Authenticate with Cloudflare

```bash
# Login to Cloudflare (opens browser for OAuth)
wrangler login

# Verify authentication
wrangler whoami
```

## Step 2: Get Your Account ID

```bash
# List your accounts and get the account ID
wrangler whoami

# Or get it from the Cloudflare Dashboard:
# Dashboard → Workers & Pages → Overview → Account ID (right sidebar)
```

Update `wrangler.toml` with your account ID:
```toml
account_id = "your-actual-account-id"
```

## Step 3: Create R2 Bucket for File Storage

```bash
# Create production bucket
wrangler r2 bucket create ai-resume-storage

# Create preview bucket for development
wrangler r2 bucket create ai-resume-storage-preview

# Verify buckets were created
wrangler r2 bucket list
```

The buckets are now bound in `wrangler.toml` as `RESUME_BUCKET`.

## Step 4: Create KV Namespace for Caching

```bash
# Create production KV namespace
wrangler kv:namespace create RESUME_CACHE

# Create preview KV namespace for development
wrangler kv:namespace create RESUME_CACHE --preview

# The command output will show the namespace IDs
# Example output:
# ✨ Success!
# Add the following to your wrangler.toml:
# id = "abc123..."
# preview_id = "def456..."
```

Update `wrangler.toml` with the namespace IDs:
```toml
[[kv_namespaces]]
binding = "RESUME_CACHE"
id = "your-actual-kv-namespace-id"
preview_id = "your-actual-preview-kv-namespace-id"
```

## Step 5: Create D1 Database

```bash
# Create D1 database
wrangler d1 create ai-resume-db

# The command output will show the database ID
# Example output:
# ✨ Success!
# Created DB 'ai-resume-db'
# database_id = "xyz789..."
```

Update `wrangler.toml` with the database ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "ai-resume-db"
database_id = "your-actual-d1-database-id"
```

## Step 6: Initialize D1 Database Schema

```bash
# Create the database schema (will be created in task 5)
# For now, verify D1 is accessible
wrangler d1 execute ai-resume-db --command "SELECT 1"
```

## Step 7: Configure Environment Variables and Secrets

### Update .env file for local development

Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

### Set Cloudflare Secrets (for production)

```bash
# OpenRouter API Key
wrangler secret put OPENROUTER_API_KEY
# Paste your key when prompted

# GitHub OAuth Secret
wrangler secret put GITHUB_CLIENT_SECRET
# Paste your secret when prompted

# LinkedIn OAuth Secret
wrangler secret put LINKEDIN_CLIENT_SECRET
# Paste your secret when prompted

# NextAuth Secret
wrangler secret put NEXTAUTH_SECRET
# Generate with: openssl rand -base64 32

# Cloudflare API Token (for Pages deployment)
wrangler secret put CLOUDFLARE_API_TOKEN
# Create at: Dashboard → My Profile → API Tokens
```

### Create Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template: "Edit Cloudflare Workers"
4. Add permissions:
   - Account → Workers R2 Storage → Edit
   - Account → Workers KV Storage → Edit
   - Account → D1 → Edit
   - Account → Cloudflare Pages → Edit
5. Copy the token and save it securely

Update `.env`:
```bash
CLOUDFLARE_API_TOKEN="your-actual-api-token"
CLOUDFLARE_ACCOUNT_ID="your-actual-account-id"
```

## Step 8: Test Local Development Environment

```bash
# Start local development server with Wrangler
wrangler dev --local

# This will:
# - Start a local Workers runtime
# - Emulate R2, KV, and D1 locally
# - Hot-reload on file changes
# - Run on http://localhost:8787
```

### Test with Next.js Development Server

```bash
# Install dependencies first
npm install

# Start Next.js dev server (will use local .env)
npm run dev
```

## Step 9: Verify Configuration

Create a simple test to verify all bindings work:

```bash
# Test R2 bucket access
wrangler r2 object put ai-resume-storage/test.txt --file=package.json
wrangler r2 object get ai-resume-storage/test.txt
wrangler r2 object delete ai-resume-storage/test.txt

# Test KV namespace access
wrangler kv:key put --namespace-id=your-kv-namespace-id "test-key" "test-value"
wrangler kv:key get --namespace-id=your-kv-namespace-id "test-key"
wrangler kv:key delete --namespace-id=your-kv-namespace-id "test-key"

# Test D1 database access
wrangler d1 execute ai-resume-db --command "SELECT datetime('now')"
```

## Configuration Summary

After completing all steps, your `wrangler.toml` should have:
- ✅ Account ID
- ✅ R2 bucket bindings with bucket names
- ✅ KV namespace bindings with IDs
- ✅ D1 database binding with ID
- ✅ Durable Objects configuration

Your `.env` should have:
- ✅ All Cloudflare credentials
- ✅ API tokens and secrets
- ✅ Service configuration

## Troubleshooting

### "Wrangler requires at least Node.js v20.0.0"
```bash
# Upgrade Node.js using nvm
nvm install 20
nvm use 20
nvm alias default 20
```

### "Authentication required"
```bash
# Re-authenticate
wrangler logout
wrangler login
```

### "Namespace/Bucket not found"
```bash
# List all resources
wrangler r2 bucket list
wrangler kv:namespace list
wrangler d1 list
```

### "Invalid account ID"
```bash
# Get your account ID
wrangler whoami
```

## Next Steps

Once setup is complete:
1. ✅ Task 1 complete - Infrastructure configured
2. ➡️ Task 2 - Update project dependencies
3. ➡️ Task 3 - Migrate file storage to R2
4. ➡️ Task 4 - Implement Durable Objects queue
5. ➡️ Task 5 - Migrate database to D1

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [KV Documentation](https://developers.cloudflare.com/kv/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
