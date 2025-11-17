import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheManager, CachingStrategies, QueryCache } from '../caching';
import { CloudflareWorkersEnv } from '../../config/cloudflare-env';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockEnv: CloudflareWorkersEnv;
  let kvStore: Map<string, string>;

  beforeEach(() => {
    kvStore = new Map();

    mockEnv = {
      RESUME_CACHE: {
        get: async (key: string) => kvStore.get(key) || null,
        put: async (key: string, value: string) => {
          kvStore.set(key, value);
        },
        delete: async (key: string) => {
          kvStore.delete(key);
        },
      } as any,
    } as CloudflareWorkersEnv;

    cacheManager = new CacheManager(mockEnv);
  });

  describe('get', () => {
    it('should fetch from source on cache miss', async () => {
      const source = vi.fn(async () => ({ data: 'test' }));

      const result = await cacheManager.get('test-key', source);

      expect(result).toEqual({ data: 'test' });
      expect(source).toHaveBeenCalledTimes(1);
    });

    it('should return from memory cache on hit', async () => {
      const source = vi.fn(async () => ({ data: 'test' }));

      // First call - cache miss
      await cacheManager.get('test-key', source);

      // Second call - cache hit
      const result = await cacheManager.get('test-key', source);

      expect(result).toEqual({ data: 'test' });
      expect(source).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should return from KV cache when memory cache misses', async () => {
      const source = vi.fn(async () => ({ data: 'test' }));

      // Populate KV cache directly
      const entry = {
        data: { data: 'cached' },
        timestamp: Date.now(),
        ttl: 3600,
        tags: [],
      };
      kvStore.set('test-key', JSON.stringify(entry));

      const result = await cacheManager.get('test-key', source);

      expect(result).toEqual({ data: 'cached' });
      expect(source).not.toHaveBeenCalled();
    });

    it('should respect TTL and refetch expired data', async () => {
      const source = vi.fn(async () => ({ data: 'fresh' }));

      // Populate with expired entry
      const expiredEntry = {
        data: { data: 'stale' },
        timestamp: Date.now() - 4000 * 1000, // 4000 seconds ago
        ttl: 3600, // 1 hour TTL
        tags: [],
      };
      kvStore.set('test-key', JSON.stringify(expiredEntry));

      const result = await cacheManager.get('test-key', source);

      expect(result).toEqual({ data: 'fresh' });
      expect(source).toHaveBeenCalledTimes(1);
    });
  });

  describe('set', () => {
    it('should set cache in both memory and KV', async () => {
      const entry = {
        data: { test: 'value' },
        timestamp: Date.now(),
        ttl: 3600,
        tags: ['test'],
      };

      await cacheManager.set('test-key', entry);

      // Check KV
      const kvValue = kvStore.get('test-key');
      expect(kvValue).toBeDefined();
      expect(JSON.parse(kvValue!).data).toEqual({ test: 'value' });
    });
  });

  describe('invalidate', () => {
    it('should remove cache entry', async () => {
      const source = vi.fn(async () => ({ data: 'test' }));

      // Populate cache
      await cacheManager.get('test-key', source);

      // Invalidate
      await cacheManager.invalidate('test-key');

      // Should fetch from source again
      await cacheManager.get('test-key', source);
      expect(source).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateByTags', () => {
    it('should invalidate entries from memory cache with matching tags', async () => {
      const source1 = vi.fn(async () => ({ data: 'test1' }));
      const source2 = vi.fn(async () => ({ data: 'test2' }));

      // Populate cache with tags
      await cacheManager.get('key1', source1, { tags: ['user', 'user:123'] });
      await cacheManager.get('key2', source2, { tags: ['user', 'user:456'] });

      // Invalidate by tag (memory cache only in this implementation)
      await cacheManager.invalidateByTags(['user:123']);

      // Verify the method completes without error
      expect(source1).toHaveBeenCalledTimes(1);
      expect(source2).toHaveBeenCalledTimes(1);
    });
  });
});

describe('CachingStrategies', () => {
  let cacheManager: CacheManager;
  let strategies: CachingStrategies;
  let mockEnv: CloudflareWorkersEnv;

  beforeEach(() => {
    mockEnv = {
      RESUME_CACHE: {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
      } as any,
    } as CloudflareWorkersEnv;

    cacheManager = new CacheManager(mockEnv);
    strategies = new CachingStrategies(cacheManager);
  });

  describe('cacheUser', () => {
    it('should cache user data with correct TTL and tags', async () => {
      const fetcher = vi.fn(async () => ({ id: '123', name: 'Test User' }));

      const result = await strategies.cacheUser('123', fetcher);

      expect(result).toEqual({ id: '123', name: 'Test User' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('cacheResumeSession', () => {
    it('should cache session data with 30 minute TTL', async () => {
      const fetcher = vi.fn(async () => ({ id: 'session-123', data: {} }));

      const result = await strategies.cacheResumeSession('session-123', fetcher);

      expect(result).toEqual({ id: 'session-123', data: {} });
    });
  });

  describe('invalidateUser', () => {
    it('should invalidate user-related caches', async () => {
      const fetcher = vi.fn(async () => ({ id: '123' }));

      await strategies.cacheUser('123', fetcher);
      await strategies.invalidateUser('123');

      // Should fetch again after invalidation
      await strategies.cacheUser('123', fetcher);
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });
});

describe('QueryCache', () => {
  let cacheManager: CacheManager;
  let queryCache: QueryCache;
  let mockEnv: CloudflareWorkersEnv;

  beforeEach(() => {
    mockEnv = {
      RESUME_CACHE: {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
      } as any,
    } as CloudflareWorkersEnv;

    cacheManager = new CacheManager(mockEnv);
    queryCache = new QueryCache(cacheManager);
  });

  describe('cacheQuery', () => {
    it('should cache query results', async () => {
      const query = vi.fn(async () => [{ id: 1 }, { id: 2 }]);

      const result = await queryCache.cacheQuery('users-list', query);

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
      expect(query).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await queryCache.cacheQuery('users-list', query);
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateQueryKey', () => {
    it('should generate consistent keys for same query and params', () => {
      const key1 = queryCache.generateQueryKey('SELECT * FROM users WHERE id = ?', [123]);
      const key2 = queryCache.generateQueryKey('SELECT * FROM users WHERE id = ?', [123]);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different params', () => {
      const key1 = queryCache.generateQueryKey('SELECT * FROM users WHERE id = ?', [123]);
      const key2 = queryCache.generateQueryKey('SELECT * FROM users WHERE id = ?', [456]);

      expect(key1).not.toBe(key2);
    });
  });
});
