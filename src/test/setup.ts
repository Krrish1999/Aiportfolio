import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global test utilities for Cloudflare Workers environment
declare global {
  var getMiniflareBindings: () => any;
  var createMockR2Bucket: () => any;
  var createMockKVNamespace: () => any;
  var createMockD1Database: () => any;
  var createMockDurableObjectNamespace: () => any;
}

// Helper to create mock R2 bucket
globalThis.createMockR2Bucket = () => ({
  put: vi.fn(),
  get: vi.fn(),
  head: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
});

// Helper to create mock KV namespace
globalThis.createMockKVNamespace = () => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  getWithMetadata: vi.fn(),
});

// Helper to create mock D1 database
globalThis.createMockD1Database = () => {
  const mockData = new Map<string, any>();
  
  return {
    prepare: vi.fn((sql: string) => {
      const statement = {
        _sql: sql,
        _params: [] as any[],
      };
      return {
        bind: vi.fn((...params: any[]) => {
          statement._params = params;
          return {
            ...statement,
            first: vi.fn(async () => {
              // Mock implementation for common SQL operations
              return null;
            }),
            all: vi.fn(async () => {
              return { results: [] };
            }),
            run: vi.fn(async () => {
              return { success: true };
            }),
          };
        }),
      };
    }),
    batch: vi.fn(async () => []),
    exec: vi.fn(async () => ({ success: true })),
  };
};

// Helper to create mock Durable Object namespace
globalThis.createMockDurableObjectNamespace = () => ({
  idFromName: vi.fn((name: string) => ({ name, toString: () => name })),
  idFromString: vi.fn((id: string) => ({ id, toString: () => id })),
  get: vi.fn((id: any) => ({
    fetch: vi.fn(),
  })),
});

// Helper to get Miniflare bindings for tests
globalThis.getMiniflareBindings = () => ({
  RESUME_BUCKET: createMockR2Bucket(),
  RESUME_CACHE: createMockKVNamespace(),
  DB: createMockD1Database(),
  JOB_QUEUE: createMockDurableObjectNamespace(),
  CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
  R2_PUBLIC_URL: 'https://pub-test.r2.dev',
});