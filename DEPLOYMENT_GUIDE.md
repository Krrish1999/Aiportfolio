# Quick Deployment Guide to Cloudflare Pages

## Prerequisites

### 1. Upgrade Node.js to v20+

```bash
# If you have nvm installed:
nvm install 20
nvm use 20
nvm alias default 20

# Verify version
node --version  # Should show v20.x.x
```

### 2. Login to Cloudflare

```bash
wrangler login
```

## Option 1: Deploy via Wrangler CLI (Recommended)

### Step 1: Build the app
```bash
npm run build
```

### Step 2: Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy .next --project-name=ai-resume-portfolio
```

This will:
- Create a new Cloudflare Pages project
- Upload your built Next.js app
- Give you a live URL like: `https://ai-resume-portfolio.pages.dev`

## Option 2: Deploy via Cloudflare Dashboard (Easier)

### Step 1: Push code to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 2: Connect to Cloudflare Pages
1. Go to https://dash.cloudflare.com
2. Click "Workers & Pages" → "Create application" → "Pages"
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
   - **Root directory**: `/`
5. Click "Save and Deploy"

## Important: Set Environment Variables

After deployment, you need to set environment variables in Cloudflare Pages:

1. Go to your Pages project → Settings → Environment variables
2. Add these required variables:

```
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=deepseek/deepseek-r1:free
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
NEXTAUTH_SECRET=(generate with: openssl rand -base64 32)
```

## Setup Cloudflare Resources

Before the app works fully, you need to create:

### 1. D1 Database
```bash
wrangler d1 create ai-resume-db
# Copy the database_id and update wrangler.toml
```

### 2. R2 Bucket
```bash
wrangler r2 bucket create ai-resume-storage
```

### 3. KV Namespace
```bash
wrangler kv:namespace create RESUME_CACHE
# Copy the namespace_id and update wrangler.toml
```

## Verify Deployment

Once deployed, visit your URL:
- **Production**: `https://ai-resume-portfolio.pages.dev`
- **Custom domain**: Configure in Cloudflare Pages settings

## Troubleshooting

### "Node.js version too old"
```bash
nvm install 20
nvm use 20
```

### "Build failed"
Check the build logs in Cloudflare Pages dashboard

### "Database error"
Make sure you've created the D1 database and updated wrangler.toml with the correct IDs

## Next Steps

1. ✅ Build completed
2. ⏳ Upgrade Node.js to v20+
3. ⏳ Deploy to Cloudflare Pages
4. ⏳ Set environment variables
5. ⏳ Create Cloudflare resources (D1, R2, KV)
6. ⏳ Test the live app

Your app is ready to deploy! Just upgrade Node.js and run the deployment command.
