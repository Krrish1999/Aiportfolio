import { describe, it, expect, beforeEach } from 'vitest';
import { CloudflareMonitor, MonitoredOperations } from '../monitoring';
import { CloudflareWorkersEnv } from '../../config/cloudflare-env';

describe('CloudflareMonitor', () => {
  let monitor: CloudflareMonitor;
  let mockEnv: CloudflareWorkersEnv;

  beforeEach(() => {
    mockEnv = {
      RESUME_BUCKET: {} as R2Bucket,
      RESUME_CACHE: {} as KVNamespace,
      DB: {} as D1Database,
      JOB_QUEUE: {} as DurableObjectNamespace,
    } as CloudflareWorkersEnv;

    monitor = new CloudflareMonitor(mockEnv);
  });

  describe('trackR2Operation', () => {
    it('should track R2 operations', () => {
      monitor.trackR2Operation('get', 50, 1024, true);
      monitor.trackR2Operation('put', 100, 2048, true);

      const quotas = monitor.getQuotaUsage();
      expect(quotas.r2.operations).toBe(2);
      expect(quotas.r2.bandwidth).toBe(3072);
    });

    it('should track failed operations', () => {
      monitor.trackR2Operation('get', 50, 0, false, 'File not found');

      const failed = monitor.getFailedOperations();
      expect(failed).toHaveLength(1);
      expect(failed[0].error).toBe('File not found');
    });
  });

  describe('trackKVOperation', () => {
    it('should track KV operations', () => {
      monitor.trackKVOperation('get', 10, true);
      monitor.trackKVOperation('put', 20, true);
      monitor.trackKVOperation('get', 15, true);

      const quotas = monitor.getQuotaUsage();
      expect(quotas.kv.reads).toBe(2);
      expect(quotas.kv.writes).toBe(1);
    });
  });

  describe('trackD1Query', () => {
    it('should track D1 queries', () => {
      monitor.trackD1Query('SELECT', 50, 10, true);
      monitor.trackD1Query('INSERT', 30, 1, true);

      const quotas = monitor.getQuotaUsage();
      expect(quotas.d1.queries).toBe(2);
      expect(quotas.d1.rowsRead).toBe(11);
    });
  });

  describe('trackWorkerExecution', () => {
    it('should track Worker executions', () => {
      monitor.trackWorkerExecution('handleRequest', 25, true);
      monitor.trackWorkerExecution('processJob', 50, true);

      const quotas = monitor.getQuotaUsage();
      expect(quotas.worker.requests).toBe(2);
      expect(quotas.worker.cpuTime).toBe(75);
    });
  });

  describe('getSlowOperations', () => {
    it('should identify slow operations', () => {
      monitor.trackR2Operation('get', 50, 1024, true);
      monitor.trackR2Operation('get', 1500, 1024, true);
      monitor.trackD1Query('SELECT', 2000, 100, true);

      const slowOps = monitor.getSlowOperations(1000);
      expect(slowOps).toHaveLength(2);
      expect(slowOps[0].duration).toBeGreaterThan(1000);
    });
  });

  describe('getAverageOperationTime', () => {
    it('should calculate average operation time', () => {
      monitor.trackR2Operation('get', 50, 1024, true);
      monitor.trackR2Operation('get', 100, 1024, true);
      monitor.trackR2Operation('get', 150, 1024, true);

      const avg = monitor.getAverageOperationTime('r2', 'get');
      expect(avg).toBe(100);
    });
  });

  describe('checkQuotaLimits', () => {
    it('should warn when approaching quota limits', () => {
      // Simulate high R2 usage
      for (let i = 0; i < 850000; i++) {
        monitor.trackR2Operation('get', 10, 1024, true);
      }

      const warnings = monitor.checkQuotaLimits();
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].service).toBe('R2');
      expect(warnings[0].percentage).toBeGreaterThan(80);
    });

    it('should not warn when usage is low', () => {
      monitor.trackR2Operation('get', 10, 1024, true);

      const warnings = monitor.checkQuotaLimits();
      expect(warnings).toHaveLength(0);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report', () => {
      monitor.trackR2Operation('get', 50, 1024, true);
      monitor.trackR2Operation('put', 100, 2048, true);
      monitor.trackKVOperation('get', 10, true);
      monitor.trackD1Query('SELECT', 30, 5, true);
      monitor.trackR2Operation('get', 1500, 1024, true);
      monitor.trackR2Operation('get', 50, 0, false, 'Error');

      const report = monitor.generateReport();

      expect(report.summary.totalOperations).toBe(6);
      expect(report.summary.successRate).toBeCloseTo(83.33, 1);
      expect(report.summary.slowOperations).toBe(1);
      expect(report.summary.failedOperations).toBe(1);
      expect(report.quotas.r2.operations).toBe(4);
      expect(report.quotas.kv.reads).toBe(1);
      expect(report.quotas.d1.queries).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      monitor.trackR2Operation('get', 50, 1024, true);
      monitor.trackKVOperation('get', 10, true);

      monitor.reset();

      const quotas = monitor.getQuotaUsage();
      expect(quotas.r2.operations).toBe(0);
      expect(quotas.kv.reads).toBe(0);
      expect(monitor.getServiceMetrics('r2')).toHaveLength(0);
    });
  });
});

describe('MonitoredOperations', () => {
  let monitor: CloudflareMonitor;
  let ops: MonitoredOperations;
  let mockEnv: CloudflareWorkersEnv;

  beforeEach(() => {
    mockEnv = {
      RESUME_BUCKET: {
        get: async () => ({ size: 1024, arrayBuffer: async () => new ArrayBuffer(1024) }),
        put: async () => ({}),
      } as any,
      RESUME_CACHE: {
        get: async () => 'cached-value',
        put: async () => {},
      } as any,
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => ({ results: [{ id: 1 }] }),
          }),
        }),
      } as any,
      JOB_QUEUE: {} as DurableObjectNamespace,
    } as CloudflareWorkersEnv;

    monitor = new CloudflareMonitor(mockEnv);
    ops = new MonitoredOperations(mockEnv, monitor);
  });

  describe('r2Get', () => {
    it('should track successful R2 get', async () => {
      await ops.r2Get('test-key');

      const metrics = monitor.getServiceMetrics('r2');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operation).toBe('get');
      expect(metrics[0].success).toBe(true);
    });
  });

  describe('kvGet', () => {
    it('should track successful KV get', async () => {
      const result = await ops.kvGet('test-key');

      expect(result).toBe('cached-value');
      const metrics = monitor.getServiceMetrics('kv');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operation).toBe('get');
    });
  });

  describe('d1Query', () => {
    it('should track successful D1 query', async () => {
      const result = await ops.d1Query('SELECT * FROM users WHERE id = ?', [1]);

      expect(result.results).toHaveLength(1);
      const metrics = monitor.getServiceMetrics('d1');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operation).toBe('SELECT');
    });
  });
});
