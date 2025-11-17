/**
 * TypeScript definitions for Cloudflare Pages Functions
 */

interface Env {
  // R2 Storage
  RESUME_BUCKET: R2Bucket;
  
  // KV Storage
  RESUME_CACHE: KVNamespace;
  
  // D1 Database
  DB: D1Database;
  
  // Durable Objects
  JOB_QUEUE: DurableObjectNamespace;
  
  // Environment Variables
  NODE_ENV: string;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
}

interface PagesFunction<Env = unknown> {
  (context: EventContext<Env, any, Record<string, unknown>>): Response | Promise<Response>;
}

interface EventContext<Env, P extends string, Data> {
  request: Request;
  env: Env;
  params: Record<P, string>;
  data: Data;
  next: () => Promise<Response>;
  waitUntil: (promise: Promise<any>) => void;
}
