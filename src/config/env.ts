import { z } from 'zod';

const envSchema = z.object({
  // Database (Cloudflare D1 or local SQLite)
  DATABASE_URL: z.string().default('file:./dev.db'),
  
  // Next.js
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1),
  
  // AI Services
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().default('deepseek/deepseek-r1:free'),
  
  // AI Provider Configuration
  AI_PROVIDER: z.enum(['openrouter', 'cloudflare', 'dual']).default('openrouter'),
  ENABLE_CLOUDFLARE_AI: z.string().default('false'),
  AI_FALLBACK_ENABLED: z.string().default('true'),
  WORKERS_AI_MODEL: z.string().default('@cf/meta/llama-3-8b-instruct'),
  
  // Cloudflare Account (required for production)
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  
  // File Storage (Cloudflare R2)
  R2_BUCKET_NAME: z.string().default('ai-resume-storage'),
  R2_PUBLIC_URL: z.string().optional(),
  
  // Cache (Cloudflare KV)
  KV_NAMESPACE_ID: z.string().optional(),
  
  // Database (Cloudflare D1)
  D1_DATABASE_ID: z.string().optional(),
  D1_DATABASE_NAME: z.string().default('ai-resume-db'),
  
  // GitHub Integration
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_REDIRECT_URI: z.string().url().optional(),
  GITHUB_TOKEN: z.string().optional(),
  
  // LinkedIn Integration
  LINKEDIN_CLIENT_ID: z.string().min(1),
  LINKEDIN_CLIENT_SECRET: z.string().min(1),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),
  
  // Deployment (Cloudflare Pages)
  CLOUDFLARE_PAGES_PROJECT: z.string().default('ai-resume-portfolio'),
  
  // Legacy deployment tokens (optional, for migration period)
  VERCEL_TOKEN: z.string().optional(),
  NETLIFY_TOKEN: z.string().optional(),
  
  // Application Settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => err.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missingVars}`);
    }
    throw error;
  }
}

export const env = validateEnv();