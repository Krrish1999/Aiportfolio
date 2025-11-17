/**
 * Caching Strategies for Cloudflare Services
 * 
 * Implements intelligent caching to reduce D1 and R2 operations:
 * - Multi-tier caching (memory -> KV -> D1/R2)
 * - Cache invalidation strategies
 * - TTL management
 * - Cache warming
 */

import { CloudflareEnv } from '../config/cloudflare-env';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  staleWhileRevalidate?: boolean; // Serve stale while fetching fresh
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: string[];
}

/**
 * Multi-tier cache manager
 */
export class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly MEMORY_CACHE_SIZE = 100; // Max items in memory

  constructor(private env: CloudflareEnv) {}

  /**
   * Get from cache with fallback chain: memory -> KV -> source
   */
  async get<T>(
    key: string,
    source: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const ttl = options.ttl || this.DEFAULT_TTL;

    // 1. Check memory cache
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return memoryEntry.data as T;
    }

    // 2. Check KV cache
    if (this.env.RESUME_CACHE) {
      const kvData = await this.env.RESUME_CACHE.get(key);
      if (kvData) {
        try {
          const entry: CacheEntry<T> = JSON.parse(kvData);
          if (!this.isExpired(entry)) {
            // Populate memory cache
            this.setMemoryCache(key, entry);
            return entry.data;
          }
        } catch (error) {
          // Invalid cache entry, continue to source
        }
      }
    }

    // 3. Fetch from source
    const data = await source();

    // 4. Store in caches
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      tags: options.tags || [],
    };

    await this.set(key, entry);

    return data;
  }

  /**
   * Set cache entry in both memory and KV
   */
  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Set in memory cache
    this.setMemoryCache(key, entry);

    // Set in KV cache
    if (this.env.RESUME_CACHE) {
      await this.env.RESUME_CACHE.put(key, JSON.stringify(entry), {
        expirationTtl: entry.ttl,
      });
    }
  }

  /**
   * Invalidate cache by key
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (this.env.RESUME_CACHE) {
      await this.env.RESUME_CACHE.delete(key);
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    // Invalidate memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tags.some((tag) => tags.includes(tag))) {
        this.memoryCache.delete(key);
      }
    }

    // For KV, we need to track keys by tags
    // This is a simplified implementation
    if (this.env.RESUME_CACHE) {
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const keysJson = await this.env.RESUME_CACHE.get(tagKey);
        if (keysJson) {
          const keys: string[] = JSON.parse(keysJson);
          await Promise.all(keys.map((key) => this.env.RESUME_CACHE.delete(key)));
          await this.env.RESUME_CACHE.delete(tagKey);
        }
      }
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl * 1000;
  }

  /**
   * Set memory cache with LRU eviction
   */
  private setMemoryCache(key: string, entry: CacheEntry<any>): void {
    // Simple LRU: if cache is full, remove oldest entry
    if (this.memoryCache.size >= this.MEMORY_CACHE_SIZE) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(key, entry);
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    // Note: KV doesn't have a clear all operation
    // In production, you'd need to track all keys
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    memoryHitRate: number;
  } {
    return {
      memorySize: this.memoryCache.size,
      memoryHitRate: 0, // Would need to track hits/misses
    };
  }
}

/**
 * Specific caching strategies for common operations
 */
export class CachingStrategies {
  constructor(private cacheManager: CacheManager) {}

  /**
   * Cache user data with 1 hour TTL
   */
  async cacheUser<T>(userId: string, fetcher: () => Promise<T>): Promise<T> {
    return this.cacheManager.get(`user:${userId}`, fetcher, {
      ttl: 3600,
      tags: ['user', `user:${userId}`],
    });
  }

  /**
   * Cache resume session with 30 minute TTL
   */
  async cacheResumeSession<T>(
    sessionId: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    return this.cacheManager.get(`session:${sessionId}`, fetcher, {
      ttl: 1800,
      tags: ['session', `session:${sessionId}`],
    });
  }

  /**
   * Cache portfolio with 1 hour TTL
   */
  async cachePortfolio<T>(
    portfolioId: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    return this.cacheManager.get(`portfolio:${portfolioId}`, fetcher, {
      ttl: 3600,
      tags: ['portfolio', `portfolio:${portfolioId}`],
    });
  }

  /**
   * Cache file metadata with 24 hour TTL
   */
  async cacheFileMetadata<T>(
    fileKey: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    return this.cacheManager.get(`file:${fileKey}`, fetcher, {
      ttl: 86400,
      tags: ['file', `file:${fileKey}`],
    });
  }

  /**
   * Cache AI-generated content with 7 day TTL
   */
  async cacheAIContent<T>(
    contentHash: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    return this.cacheManager.get(`ai:${contentHash}`, fetcher, {
      ttl: 604800,
      tags: ['ai-content'],
    });
  }

  /**
   * Invalidate user-related caches
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.cacheManager.invalidateByTags([`user:${userId}`]);
  }

  /**
   * Invalidate session-related caches
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await this.cacheManager.invalidateByTags([`session:${sessionId}`]);
  }

  /**
   * Invalidate portfolio-related caches
   */
  async invalidatePortfolio(portfolioId: string): Promise<void> {
    await this.cacheManager.invalidateByTags([`portfolio:${portfolioId}`]);
  }
}

/**
 * Query result caching for D1
 */
export class QueryCache {
  constructor(private cacheManager: CacheManager) {}

  /**
   * Cache D1 query results
   */
  async cacheQuery<T>(
    queryKey: string,
    query: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    return this.cacheManager.get(`query:${queryKey}`, query, {
      ttl,
      tags: ['query'],
    });
  }

  /**
   * Generate cache key from query and params
   */
  generateQueryKey(query: string, params: any[]): string {
    const paramsStr = JSON.stringify(params);
    return `${query}:${paramsStr}`;
  }

  /**
   * Invalidate query cache
   */
  async invalidateQueries(): Promise<void> {
    await this.cacheManager.invalidateByTags(['query']);
  }
}

/**
 * R2 object caching
 */
export class ObjectCache {
  constructor(private cacheManager: CacheManager) {}

  /**
   * Cache small R2 objects in KV
   * Only cache objects < 25MB (KV limit)
   */
  async cacheObject(
    key: string,
    fetcher: () => Promise<ArrayBuffer>,
    maxSize: number = 1024 * 1024 // 1MB default
  ): Promise<ArrayBuffer> {
    const cached = await this.cacheManager.get(
      `r2:${key}`,
      async () => {
        const buffer = await fetcher();
        if (buffer.byteLength > maxSize) {
          // Don't cache large objects
          return null;
        }
        return buffer;
      },
      {
        ttl: 3600,
        tags: ['r2-object'],
      }
    );

    if (cached === null) {
      // Object too large, fetch directly
      return fetcher();
    }

    return cached;
  }

  /**
   * Invalidate R2 object cache
   */
  async invalidateObject(key: string): Promise<void> {
    await this.cacheManager.invalidate(`r2:${key}`);
  }
}

/**
 * Cache warming utilities
 */
export class CacheWarmer {
  constructor(
    private cacheManager: CacheManager,
    private strategies: CachingStrategies
  ) {}

  /**
   * Warm cache for frequently accessed data
   */
  async warmCache(config: {
    users?: string[];
    sessions?: string[];
    portfolios?: string[];
  }): Promise<void> {
    const promises: Promise<any>[] = [];

    // Warm user caches
    if (config.users) {
      for (const userId of config.users) {
        promises.push(
          this.strategies.cacheUser(userId, async () => {
            // Fetch user data
            return null;
          })
        );
      }
    }

    // Warm session caches
    if (config.sessions) {
      for (const sessionId of config.sessions) {
        promises.push(
          this.strategies.cacheResumeSession(sessionId, async () => {
            // Fetch session data
            return null;
          })
        );
      }
    }

    // Warm portfolio caches
    if (config.portfolios) {
      for (const portfolioId of config.portfolios) {
        promises.push(
          this.strategies.cachePortfolio(portfolioId, async () => {
            // Fetch portfolio data
            return null;
          })
        );
      }
    }

    await Promise.all(promises);
  }
}
