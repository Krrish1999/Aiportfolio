import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    environmentOptions: {
      // Miniflare configuration for Cloudflare Workers testing
      miniflare: {
        // Enable compatibility flags
        compatibilityDate: '2024-01-01',
        compatibilityFlags: ['nodejs_compat'],
        
        // Mock bindings for tests
        bindings: {
          CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
          R2_PUBLIC_URL: 'https://pub-test.r2.dev',
        },
        
        // KV namespaces
        kvNamespaces: ['RESUME_CACHE'],
        
        // R2 buckets
        r2Buckets: ['RESUME_BUCKET'],
        
        // D1 databases
        d1Databases: ['DB'],
        
        // Durable Objects
        durableObjects: {
          JOB_QUEUE: 'JobQueueDO',
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'cloudflare:workers': path.resolve(__dirname, './src/test/mocks/cloudflare-workers.ts'),
    },
  },
});