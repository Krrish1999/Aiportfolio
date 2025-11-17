# Cloudflare Pages Deployment Checklist

## Prerequisites

### System Requirements
- [ ] Node.js v20.0.0 or higher installed
- [ ] npm v10 or higher installed
- [ ] Wrangler CLI installed globally (`npm install -g wrangler`)
- [ ] Git installed and configured

### Cloudflare Account Setup
- [ ] Cloudflare account created
- [ ] Account ID obtained from dashboard
- [ ] API token created with required permissions:
  - Account.Cloudflare Pages (Edit)
  - Account.Workers R2 Storage (Edit)
  - Account.Workers KV Storage (Edit)
  - Account.D1 (Edit)

### Cloudflare Resources Created
- [ ] R2 bucket: `ai-resume-storage`
  ```bash
  wrangler r2 bucket create ai-resume-storage
  ```
- [ ] KV namespace: `RESUME_CACHE`
  ```bash
  wrangler kv:namespace create RESUME_CACHE
  wrangler kv:namespace create RESUME_CACHE --preview
  ```
- [ ] D1 database: `ai-resume-db`
  ```bash
  wrangler d1 create ai-resume-db
  ```
- [ ] Durable Objects configured in `wrangler.toml`

### Configuration Files Updated
- [ ] `wrangler.toml` - All IDs and bindings configured
- [ ] `.env` - Local environment variables set
- [ ] `next.config.js` - Cloudflare compatibility enabled
- [ ] `_worker.js` - Custom worker configuration present

## Pre-Deployment Steps

### 1. Verify System Setup
```bash
# Check Node.js version (must be >= 20.0.0)
node --version

# Check npm version
npm --version

# Check Wrangler installation
wrangler --version

# Authenticate with Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

### 2. Install Dependencies
```bash
# Install project dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Update Configuration
```bash
# Update wrangler.toml with your account ID
# Replace: account_id = "your-cloudflare-account-id"
# With: account_id = "your-actual-account-id"

# Update KV namespace ID
# Replace: id = "your-kv-namespace-id"
# With: id = "actual-kv-namespace-id"

# Update D1 database ID
# Replace: database_id = "your-d1-database-id"
# With: database_id = "actual-d1-database-id"
```

### 4. Apply Database Migrations
```bash
# Apply D1 migrations
wrangler d1 execute ai-resume-db --file=./prisma/migrations/d1_initial_migration.sql

# Verify migrations
wrangler d1 execute ai-resume-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 5. Configure Secrets
```bash
# Set OpenRouter API key
wrangler secret put OPENROUTER_API_KEY

# Set GitHub OAuth secret
wrangler secret put GITHUB_CLIENT_SECRET

# Set LinkedIn OAuth secret
wrangler secret put LINKEDIN_CLIENT_SECRET

# Set NextAuth secret
wrangler secret put NEXTAUTH_SECRET

# Set Cloudflare API token
wrangler secret put CLOUDFLARE_API_TOKEN
```

### 6. Run Pre-Deployment Check
```bash
# Run comprehensive checks
npm run cf:check

# Expected output: All critical checks passed
```

### 7. Run Tests
```bash
# Run all tests
npm run test:run

# Expected: All tests passing
```

### 8. Build Application
```bash
# Build Next.js application
npm run build

# Prepare for Pages deployment
npm run pages:prepare

# Verify build output
ls -la .next/
```

## Deployment Steps

### 1. Deploy to Staging (Recommended First)
```bash
# Deploy to staging environment
npm run cf:deploy:staging

# Expected output:
# ✨ Deployment complete!
# ✨ https://ai-resume-portfolio-staging.pages.dev
```

### 2. Verify Staging Deployment
```bash
# Set deployment URL for verification
export DEPLOYMENT_URL="https://ai-resume-portfolio-staging.pages.dev"

# Run verification script
npm run cf:verify

# Expected: All verifications passed
```

### 3. Test Staging Manually
```bash
# Test main page
curl -I https://ai-resume-portfolio-staging.pages.dev

# Test API routes
curl https://ai-resume-portfolio-staging.pages.dev/api/status/test

# Test file upload (with actual file)
curl -X POST https://ai-resume-portfolio-staging.pages.dev/api/upload \
  -F "file=@test-resume.pdf"
```

### 4. Deploy to Production
```bash
# Deploy to production environment
npm run cf:deploy:production

# Expected output:
# ✨ Deployment complete!
# ✨ https://ai-resume-portfolio.pages.dev
```

### 5. Verify Production Deployment
```bash
# Set deployment URL for verification
export DEPLOYMENT_URL="https://ai-resume-portfolio.pages.dev"

# Run verification script
npm run cf:verify

# Expected: All verifications passed
```

## Post-Deployment Steps

### 1. Monitor Deployment
```bash
# View real-time logs
wrangler tail

# Check deployment status
wrangler pages deployment list --project-name=ai-resume-portfolio

# View latest deployment
wrangler pages deployment list --project-name=ai-resume-portfolio | head -n 5
```

### 2. Test All Functionality

#### Test File Upload and R2 Storage
- [ ] Upload a test resume file
- [ ] Verify file appears in R2 bucket
- [ ] Download the file
- [ ] Delete the file

```bash
# Check R2 bucket contents
wrangler r2 object list ai-resume-storage
```

#### Test Job Processing with Durable Objects
- [ ] Create a job by uploading a resume
- [ ] Check job status
- [ ] Verify job completes successfully
- [ ] Cancel a job

#### Test Database Operations with D1
- [ ] Create a user
- [ ] Create a resume session
- [ ] Create a portfolio
- [ ] Query data

```bash
# Query users
wrangler d1 execute ai-resume-db --command="SELECT * FROM users LIMIT 5;"

# Query sessions
wrangler d1 execute ai-resume-db --command="SELECT * FROM resume_sessions LIMIT 5;"

# Query portfolios
wrangler d1 execute ai-resume-db --command="SELECT * FROM portfolios LIMIT 5;"
```

#### Test Portfolio Deployment
- [ ] Create a portfolio
- [ ] Deploy to Pages
- [ ] Verify deployment URL works
- [ ] Test custom domain (if configured)

### 3. Configure Custom Domain (Optional)
```bash
# Add custom domain
wrangler pages domain add ai-resume-portfolio your-domain.com

# Verify domain setup
wrangler pages domain list --project-name=ai-resume-portfolio
```

#### DNS Configuration
Add CNAME record in your DNS provider:
```
Type: CNAME
Name: @ (or subdomain like www)
Target: ai-resume-portfolio.pages.dev
TTL: Auto
Proxy: Enabled (if using Cloudflare DNS)
```

#### Verify SSL Certificate
```bash
# Check SSL certificate
curl -I https://your-domain.com

# Expected: HTTP/2 200 with valid SSL
```

### 4. Set Up Monitoring

#### Cloudflare Dashboard
- [ ] Navigate to Workers & Pages → ai-resume-portfolio
- [ ] Check Analytics tab for metrics
- [ ] Review error logs
- [ ] Monitor resource usage

#### Set Up Alerts (Optional)
- [ ] Configure email alerts for errors
- [ ] Set up Slack/Discord webhooks
- [ ] Configure PagerDuty integration

### 5. Performance Optimization

#### Check Performance Metrics
- [ ] Page load time < 2 seconds
- [ ] API response time < 500ms
- [ ] Cold start time < 50ms
- [ ] Cache hit rate > 90%

#### Optimize if Needed
```bash
# Check cache headers
curl -I https://ai-resume-portfolio.pages.dev/_next/static/

# Check R2 performance
wrangler r2 bucket info ai-resume-storage

# Check D1 query performance
# (Monitor in Cloudflare Dashboard)
```

### 6. Security Verification

- [ ] All secrets configured (not in code)
- [ ] CORS headers properly set
- [ ] Security headers in place
- [ ] API routes protected with authentication
- [ ] Input validation working
- [ ] Rate limiting configured (if needed)

```bash
# Check security headers
curl -I https://ai-resume-portfolio.pages.dev

# Expected headers:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
```

## Rollback Procedure

If issues are detected after deployment:

### 1. Identify Issue
```bash
# Check logs for errors
wrangler tail --status error

# Check deployment status
wrangler pages deployment list --project-name=ai-resume-portfolio
```

### 2. Rollback to Previous Deployment
```bash
# List recent deployments
wrangler pages deployment list --project-name=ai-resume-portfolio

# Rollback to specific deployment
wrangler pages deployment rollback <deployment-id> --project-name=ai-resume-portfolio
```

### 3. Verify Rollback
```bash
# Run verification
npm run cf:verify

# Check logs
wrangler tail
```

### 4. Fix Issues
- Review error logs
- Fix code issues
- Test locally
- Redeploy

## Troubleshooting

### Node.js Version Too Old
```bash
# Install Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js 20
nvm install 20
nvm use 20

# Verify version
node --version
```

### Wrangler Authentication Failed
```bash
# Re-authenticate
wrangler logout
wrangler login

# Verify
wrangler whoami
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
# Check project exists
wrangler pages project list

# Create project if needed
wrangler pages project create ai-resume-portfolio

# Try deployment again
npm run cf:deploy:staging
```

### API Routes Not Working
1. Check `_routes.json` includes `/api/*`
2. Verify bindings in `wrangler.toml`
3. Check secrets are set: `wrangler secret list`
4. Review logs: `wrangler tail`

### R2 Storage Issues
```bash
# Verify bucket exists
wrangler r2 bucket list

# Check bucket binding
grep -A 3 "r2_buckets" wrangler.toml

# Test bucket access
wrangler r2 object list ai-resume-storage
```

### D1 Database Issues
```bash
# Verify database exists
wrangler d1 list

# Check migrations
wrangler d1 execute ai-resume-db --command="SELECT name FROM sqlite_master WHERE type='table';"

# Re-apply migrations if needed
wrangler d1 execute ai-resume-db --file=./prisma/migrations/d1_initial_migration.sql
```

### Durable Objects Issues
1. Check binding in `wrangler.toml`
2. Verify migrations applied
3. Check class name: `JobQueueDO`
4. Review logs: `wrangler tail`

## Success Criteria

Deployment is successful when:

- ✅ All pre-deployment checks pass
- ✅ Build completes without errors
- ✅ Deployment completes successfully
- ✅ All verification tests pass
- ✅ Main page loads correctly
- ✅ All API routes respond
- ✅ File upload works (R2)
- ✅ Job processing works (Durable Objects)
- ✅ Database queries work (D1)
- ✅ Portfolio deployment works
- ✅ No errors in logs
- ✅ Performance metrics acceptable
- ✅ Security headers present
- ✅ Custom domain works (if configured)

## Next Steps

After successful deployment:

1. ✅ Monitor for 24-48 hours
2. ✅ Run data migration (Task 13)
3. ✅ Update documentation
4. ✅ Train team on new infrastructure
5. ✅ Decommission AWS resources (Task 15)

## Support Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Cloudflare Discord](https://discord.gg/cloudflaredev)

---

**Deployment Date**: _____________

**Deployed By**: _____________

**Deployment URL**: _____________

**Custom Domain**: _____________

**Status**: _____________

**Notes**: _____________
