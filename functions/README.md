# Cloudflare Pages Functions

This directory contains Cloudflare Pages Functions that have access to Cloudflare bindings (R2, D1, KV, Durable Objects).

## How It Works

Pages Functions run as Cloudflare Workers and can access bindings that Next.js API routes cannot. Files in this directory are deployed alongside your Next.js app.

## File Structure

```
functions/
├── _middleware.ts          # Global middleware (CORS, auth, etc.)
├── api/
│   └── upload.ts          # File upload with R2 storage
└── README.md
```

## Setting Up Bindings

### 1. Create R2 Bucket
```bash
wrangler r2 bucket create ai-resume-storage
```

### 2. Create KV Namespace
```bash
wrangler kv:namespace create RESUME_CACHE
wrangler kv:namespace create RESUME_CACHE --preview
```

### 3. Create D1 Database
```bash
wrangler d1 create ai-resume-db
wrangler d1 execute ai-resume-db --file=./prisma/migrations/d1_initial_migration.sql
```

### 4. Configure Bindings in Cloudflare Dashboard

Go to your Pages project → Settings → Functions → Bindings:

**R2 Bucket Bindings:**
- Variable name: `RESUME_BUCKET`
- R2 bucket: `ai-resume-storage`

**KV Namespace Bindings:**
- Variable name: `RESUME_CACHE`
- KV namespace: Select your created namespace

**D1 Database Bindings:**
- Variable name: `DB`
- D1 database: `ai-resume-db`

## API Endpoints

### POST /api/upload
Upload a resume file to R2 storage.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: 
  - `file`: File (required)
  - `userId`: string (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "fileName": "resume.pdf",
    "fileSize": 12345,
    "fileType": "application/pdf",
    "status": "uploaded"
  }
}
```

## Development

Pages Functions are automatically deployed with your Pages project. No additional configuration needed in your Next.js code.

## Notes

- Functions in `/functions/api/` map to `/api/*` routes
- Functions take precedence over Next.js API routes
- Access bindings via `context.env` parameter
- TypeScript types are available via `@cloudflare/workers-types`
