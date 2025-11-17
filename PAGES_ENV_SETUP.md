# Cloudflare Pages Environment Variables Setup

This document describes how to configure environment variables for Cloudflare Pages deployment.

## Required Environment Variables

### 1. Cloudflare Infrastructure
These are automatically available through Wrangler bindings and don't need to be set as environment variables:
- `RESUME_BUCKET` (R2 binding)
- `RESUME_CACHE` (KV binding)
- `DB` (D1 binding)
- `JOB_QUEUE` (Durable Objects binding)

### 2. API Keys and Secrets
Set these in Cloudflare Pages dashboard or via Wrangler CLI:

```bash
# OpenRouter API Key for AI content generation
wrangler pages secret put OPENROUTER_API_KEY

# GitHub OAuth credentials
wrangler pages secret put GITHUB_CLIENT_ID
wrangler pages secret put GITHUB_CLIENT_SECRET

# LinkedIn OAuth credentials (optional)
wrangler pages secret put LINKEDIN_CLIENT_ID
wrangler pages secret put LINKEDIN_CLIENT_SECRET

# NextAuth secret for session encryption
wrangler pages secret put NEXTAUTH_SECRET

# Cloudflare API token for deployment operations
wrangler pages secret put CLOUDFLARE_API_TOKEN
```

### 3. Public Environment Variables
Set these in the Cloudflare Pages dashboard under Settings → Environment Variables:

**Production:**
- `NODE_ENV` = `production`
- `NEXT_PUBLIC_APP_URL` = `https://your-domain.pages.dev`
- `R2_PUBLIC_URL` = `https://pub-your-account-id.r2.dev`
- `CLOUDFLARE_ACCOUNT_ID` = `your-account-id`
- `OPENROUTER_MODEL` = `deepseek/deepseek-r1:free`
- `WORKERS_AI_MODEL` = `@cf/meta/llama-3-8b-instruct`

**Preview (Staging):**
- `NODE_ENV` = `staging`
- `NEXT_PUBLIC_APP_URL` = `https://staging.your-domain.pages.dev`
- `R2_PUBLIC_URL` = `https://pub-your-account-id.r2.dev`
- `CLOUDFLARE_ACCOUNT_ID` = `your-account-id`
- `OPENROUTER_MODEL` = `deepseek/deepseek-r1:free`
- `WORKERS_AI_MODEL` = `@cf/meta/llama-3-8b-instruct`

## Setting Environment Variables

### Via Cloudflare Dashboard

1. Go to Cloudflare Dashboard → Pages → Your Project
2. Click on "Settings" → "Environment Variables"
3. Add variables for Production and Preview environments
4. Click "Save"

### Via Wrangler CLI

For secrets (sensitive values):
```bash
# Set a secret for production
wrangler pages secret put SECRET_NAME --project-name=ai-resume-portfolio

# Set a secret for preview
wrangler pages secret put SECRET_NAME --project-name=ai-resume-portfolio --env=preview
```

For public variables, add them to `wrangler.toml`:
```toml
[vars]
NODE_ENV = "production"
R2_PUBLIC_URL = "https://pub-your-account-id.r2.dev"
```

## Environment Variable Validation

The application validates required environment variables at startup. See `src/config/env.ts` for the validation logic.

If required variables are missing, the application will fail to start with a clear error message indicating which variables need to be set.

## Local Development

For local development with `wrangler pages dev`, create a `.dev.vars` file in the project root:

```bash
# .dev.vars (DO NOT COMMIT THIS FILE)
OPENROUTER_API_KEY=your-key-here
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
NEXTAUTH_SECRET=your-secret-here
CLOUDFLARE_API_TOKEN=your-token-here
```

Add `.dev.vars` to your `.gitignore` to prevent committing secrets.

## Testing Environment Variables

To test if environment variables are properly configured:

```bash
# Test locally
npm run cf:dev

# Test in production (after deployment)
curl https://your-domain.pages.dev/api/health
```

## Troubleshooting

### Variables Not Available in API Routes

If environment variables are not available in your API routes:

1. Ensure they're set in the Cloudflare Pages dashboard
2. Redeploy the application after setting variables
3. Check that you're accessing them correctly:
   - Secrets: `env.SECRET_NAME` (from Workers binding)
   - Public vars: `process.env.VAR_NAME` or `env.VAR_NAME`

### Bindings Not Working

If R2, KV, or D1 bindings are not working:

1. Verify `wrangler.toml` has correct binding configurations
2. Ensure resources are created: `wrangler r2 bucket list`, `wrangler kv:namespace list`, `wrangler d1 list`
3. Check that binding names match in code and configuration
4. Redeploy after updating `wrangler.toml`

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use different secrets** for production and preview environments
3. **Rotate secrets regularly**, especially API keys
4. **Use least privilege** - only grant necessary permissions
5. **Monitor usage** - check Cloudflare Analytics for unusual activity

## References

- [Cloudflare Pages Environment Variables](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)
- [Wrangler Secrets Management](https://developers.cloudflare.com/workers/wrangler/commands/#secret)
- [Cloudflare Workers Bindings](https://developers.cloudflare.com/workers/configuration/bindings/)
