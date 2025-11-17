/**
 * Cloudflare Environment Configuration and Validation
 * 
 * This module provides type-safe access to Cloudflare environment variables
 * and validates that all required credentials are present.
 */

import { z } from 'zod';

/**
 * Cloudflare environment variable schema
 */
const CloudflareEnvSchema = z.object({
  // Cloudflare Account
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'Cloudflare Account ID is required'),
  CLOUDFLARE_API_TOKEN: z.string().min(1, 'Cloudflare API Token is required'),
  
  // R2 Storage
  R2_BUCKET_NAME: z.string().default('ai-resume-storage'),
  R2_BINDING: z.string().default('RESUME_BUCKET'),
  R2_PUBLIC_URL: z.string().optional(),
  
  // KV Cache
  KV_NAMESPACE_ID: z.string().optional(),
  KV_BINDING: z.string().default('RESUME_CACHE'),
  
  // D1 Database
  D1_DATABASE_ID: z.string().optional(),
  D1_DATABASE_NAME: z.string().default('ai-resume-db'),
  D1_BINDING: z.string().default('DB'),
  
  // Durable Objects
  DO_JOB_QUEUE_BINDING: z.string().default('JOB_QUEUE'),
  DO_JOB_QUEUE_CLASS: z.string().default('JobQueueDO'),
  
  // Cloudflare AI (Optional)
  WORKERS_AI_BINDING: z.string().default('AI'),
  WORKERS_AI_MODEL: z.string().default('@cf/meta/llama-3-8b-instruct'),
  ENABLE_CLOUDFLARE_AI: z.string().default('false'),
  
  // Cloudflare Pages
  CLOUDFLARE_PAGES_PROJECT: z.string().default('ai-resume-portfolio'),
  
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type CloudflareEnv = z.infer<typeof CloudflareEnvSchema>;

/**
 * Validates Cloudflare environment variables
 * @throws {Error} If required environment variables are missing or invalid
 */
export function validateCloudflareEnv(): CloudflareEnv {
  try {
    const env = CloudflareEnvSchema.parse({
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
      R2_BINDING: process.env.R2_BINDING,
      R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
      KV_NAMESPACE_ID: process.env.KV_NAMESPACE_ID,
      KV_BINDING: process.env.KV_BINDING,
      D1_DATABASE_ID: process.env.D1_DATABASE_ID,
      D1_DATABASE_NAME: process.env.D1_DATABASE_NAME,
      D1_BINDING: process.env.D1_BINDING,
      DO_JOB_QUEUE_BINDING: process.env.DO_JOB_QUEUE_BINDING,
      DO_JOB_QUEUE_CLASS: process.env.DO_JOB_QUEUE_CLASS,
      WORKERS_AI_BINDING: process.env.WORKERS_AI_BINDING,
      WORKERS_AI_MODEL: process.env.WORKERS_AI_MODEL,
      ENABLE_CLOUDFLARE_AI: process.env.ENABLE_CLOUDFLARE_AI,
      CLOUDFLARE_PAGES_PROJECT: process.env.CLOUDFLARE_PAGES_PROJECT,
      NODE_ENV: process.env.NODE_ENV,
    });
    
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => {
        const path = err.path.join('.');
        return `  - ${path}: ${err.message}`;
      }).join('\n');
      
      throw new Error(
        `Cloudflare environment validation failed:\n${missingVars}\n\n` +
        `Please ensure all required Cloudflare credentials are set in your .env file.\n` +
        `See .env.example for reference.`
      );
    }
    throw error;
  }
}

/**
 * Gets validated Cloudflare environment variables
 * Returns null if validation fails (useful for optional checks)
 */
export function getCloudflareEnv(): CloudflareEnv | null {
  try {
    return validateCloudflareEnv();
  } catch {
    return null;
  }
}

/**
 * Checks if Cloudflare environment is properly configured
 */
export function isCloudflareConfigured(): boolean {
  return getCloudflareEnv() !== null;
}

/**
 * Gets a specific Cloudflare environment variable with type safety
 */
export function getCloudflareEnvVar<K extends keyof CloudflareEnv>(
  key: K
): CloudflareEnv[K] | undefined {
  const env = getCloudflareEnv();
  return env?.[key];
}

/**
 * Cloudflare Workers environment interface
 * This represents the bindings available in the Workers runtime
 */
export interface CloudflareWorkersEnv {
  // R2 Bucket binding
  RESUME_BUCKET: R2Bucket;
  
  // KV Namespace binding
  RESUME_CACHE: KVNamespace;
  
  // D1 Database binding
  DB: D1Database;
  
  // Durable Object binding
  JOB_QUEUE: DurableObjectNamespace;
  
  // Workers AI binding (optional)
  AI?: Ai;
  
  // Environment variables
  CLOUDFLARE_ACCOUNT_ID: string;
  R2_PUBLIC_URL?: string;
  WORKERS_AI_MODEL?: string;
  ENABLE_CLOUDFLARE_AI?: string;
  ENCRYPTION_KEY?: string;
}

/**
 * Type guard to check if running in Cloudflare Workers environment
 */
export function isWorkersEnvironment(env: any): env is CloudflareWorkersEnv {
  return (
    typeof env === 'object' &&
    env !== null &&
    'RESUME_BUCKET' in env &&
    'RESUME_CACHE' in env &&
    'DB' in env
  );
}

/**
 * Development mode check
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Production mode check
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Test mode check
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}
