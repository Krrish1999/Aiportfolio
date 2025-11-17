import { DatabaseService } from '@/services/database';
import { CloudflareWorkersEnv } from './cloudflare-env';

/**
 * Create DatabaseService instance for D1 operations
 * This replaces the Prisma client for Cloudflare D1 compatibility
 * 
 * @param env - Cloudflare Workers environment with D1 binding
 * @returns DatabaseService instance
 * 
 * @example
 * ```typescript
 * const env = (request as any).env as CloudflareWorkersEnv;
 * const db = createDatabaseService(env);
 * const user = await db.createUser({ email: 'user@example.com' });
 * ```
 */
export function createDatabaseService(env: CloudflareWorkersEnv): DatabaseService {
  return new DatabaseService(env);
}

/**
 * Legacy Prisma client export for backward compatibility during migration
 * @deprecated Use createDatabaseService instead
 */
export const prisma = null;

// Note: Prisma is no longer used with Cloudflare D1
// All database operations should use DatabaseService with D1 bindings