# Cloudflare Pages Deployment - Quick Start

This is a quick reference guide for deploying the AI Resume-to-Portfolio application to Cloudflare Pages.

## Prerequisites

1. **Node.js v20.0.0+** installed
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **Cloudflare account** with Workers/Pages enabled
4. **Cloudflare resources** created (R2, KV, D1)

## Quick Deployment

### 1. One-Command Deployment

```bash
# Deploy to staging
npm run cf:deploy:staging

# Deploy to production
npm run cf:deploy:production
```

This automated script will:
- ✅ Run pre-deployment checks
- ✅ Run tests
- ✅ Build the application
- ✅ Prepare for Pages deployment
- ✅ Deploy to Cloudflare Pages
- ✅ Provide deployment URL

### 2. Manual Step-by-Step

If you prefer manual control:

```bash
# Step 1: Check prerequisites
npm run cf:check

# Step 2: Run tests
npm run test:run

# Step 3: Build application
npm run build

# Step 4: Prepare for Pages
npm run pages:prepare

# Step 5: Deploy
wrangler pages deploy .next --project-name=ai-resume-portfolio --branch=main

# Step 6: Verify
npm run cf:verify
```

## First-Time Setup

### 1. Install Wrangler and Authenticate

```bash
# Install Wrangler globally
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

### 2. Create Cloudflare Resources

```bash
# Run setup script
npm run cf:setup

# Or manually create resources:
wrangler r2 bucket create ai-resume-storage
wrangler kv:namespace create RESUME_CACHE
wrangler d1 create ai-resume-db
```

### 3. Update Configuration

Edit `wrangler.toml` and replace placeholder IDs:

```toml
account_id = "your-actual-account-id"

[[kv_namespaces]]
id = "your-actual-kv-namespace-id"

[[d1_databases]]
database_id = "your-actual-d1-database-id"
```

### 4. Configure Secrets

```bash
wrangler secret put OPENROUTER_API_KEY
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put LINKEDIN_CLIENT_SECRET
wrangler secret put NEXTAUTH_SECRET
wrangler secret put CLOUDFLARE_API_TOKEN
```

### 5. Apply Database Migrations

```bash
wrangler d1 execute ai-resume-db --file=./prisma/migrations/d1_initial_migration.sql
```

## Verification

### Automated Verification

```bash
# Set deployment URL
export DEPLOYMENT_URL="https://ai-resume-portfolio.pages.dev"

# Run verification
npm run cf:verify
```

### Manual Testing

```bash
# Test main page
curl -I https://ai-resume-portfolio.pages.dev

# Test API routes
curl https://ai-resume-portfolio.pages.dev/api/status/test

# View logs
wrangler tail
```

## Common Commands

```bash
# Pre-deployment check
npm run cf:check

# Deploy to staging
npm run cf:deploy:staging

# Deploy to production
npm run cf:deploy:production

# Verify deployment
npm run cf:verify

# View logs
wrangler tail

# List deployments
wrangler pages deployment list --project-name=ai-resume-portfolio

# Rollback deployment
wrangler pages deployment rollback <deployment-id> --project-name=ai-resume-portfolio
```

## Troubleshooting

### Node.js Version Too Old

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js 20
nvm install 20
nvm use 20
```

### Build Fails

```bash
# Clear cache and rebuild
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

### Deployment Fails

```bash
# Re-authenticate
wrangler logout
wrangler login

# Try again
npm run cf:deploy:staging
```

### API Routes Not Working

1. Check `_routes.json` includes `/api/*`
2. Verify bindings in `wrangler.toml`
3. Check secrets: `wrangler secret list`
4. View logs: `wrangler tail`

## Environment Variables

### Required Secrets (set with `wrangler secret put`)

- `OPENROUTER_API_KEY` - OpenRouter API key for AI
- `GITHUB_CLIENT_SECRET` - GitHub OAuth secret
- `LINKEDIN_CLIENT_SECRET` - LinkedIn OAuth secret
- `NEXTAUTH_SECRET` - NextAuth.js secret
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token

### Public Variables (in `wrangler.toml`)

- `NODE_ENV` - Environment (production/staging)
- `R2_PUBLIC_URL` - R2 bucket public URL
- `OPENROUTER_MODEL` - AI model to use
- `WORKERS_AI_MODEL` - Cloudflare AI model

## Monitoring

### View Logs

```bash
# Real-time logs
wrangler tail

# Filter by status
wrangler tail --status error

# Filter by method
wrangler tail --method POST
```

### Check Analytics

Visit Cloudflare Dashboard:
- Workers & Pages → ai-resume-portfolio → Analytics

### Monitor Resources

```bash
# R2 usage
wrangler r2 bucket info ai-resume-storage

# D1 queries
wrangler d1 execute ai-resume-db --command="SELECT COUNT(*) FROM users;"

# KV usage (via Dashboard)
```

## Custom Domain

### Add Domain

```bash
wrangler pages domain add ai-resume-portfolio your-domain.com
```

### Configure DNS

Add CNAME record:
```
Type: CNAME
Name: @ (or subdomain)
Target: ai-resume-portfolio.pages.dev
Proxy: Enabled
```

### Verify SSL

```bash
curl -I https://your-domain.com
```

## Rollback

```bash
# List deployments
wrangler pages deployment list --project-name=ai-resume-portfolio

# Rollback to previous
wrangler pages deployment rollback <deployment-id> --project-name=ai-resume-portfolio

# Verify
npm run cf:verify
```

## Performance Tips

1. **Enable Caching**: Static assets cached automatically
2. **Use KV**: Cache frequently accessed data
3. **Batch D1 Queries**: Use batch API for multiple queries
4. **Optimize Images**: Use Cloudflare Images loader

## Security Checklist

- ✅ All secrets stored securely (not in code)
- ✅ CORS headers configured
- ✅ Security headers in `_headers`
- ✅ API routes protected
- ✅ Input validation enabled
- ✅ SSL/TLS enabled (automatic)

## Cost Monitoring

Free tier limits:
- Workers: 100,000 requests/day
- R2: 10 GB storage, 1M operations/month
- KV: 100,000 reads/day, 1,000 writes/day
- D1: 5M rows read/day, 100K rows written/day
- Pages: Unlimited requests, 500 builds/month

Monitor in Cloudflare Dashboard → Workers & Pages → Overview → Usage

## Support

- 📖 [Full Deployment Guide](./DEPLOYMENT_GUIDE.md)
- 📋 [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- 🔧 [Cloudflare Setup](./CLOUDFLARE_SETUP.md)
- 📚 [Cloudflare Docs](https://developers.cloudflare.com/pages/)
- 💬 [Cloudflare Community](https://community.cloudflare.com/)

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run cf:check` | Pre-deployment checks |
| `npm run cf:deploy:staging` | Deploy to staging |
| `npm run cf:deploy:production` | Deploy to production |
| `npm run cf:verify` | Verify deployment |
| `wrangler tail` | View logs |
| `wrangler pages deployment list` | List deployments |
| `wrangler r2 bucket list` | List R2 buckets |
| `wrangler kv:namespace list` | List KV namespaces |
| `wrangler d1 list` | List D1 databases |

---

**Need help?** See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.
