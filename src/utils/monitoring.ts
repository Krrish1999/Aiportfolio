/**
 * Cloudflare Monitoring and Analytics Utilities
 * 
 * Provides monitoring for:
 * - R2 operation counts and costs
 * - KV read/write operations and quota usage
 * - D1 query performance and row counts
 * - Workers CPU time and memory usage
 */

import { CloudflareEnv } from '../config/cloudflare-env';

export interface MetricData {
  timestamp: number;
  service: 'r2' | 'kv' | 'd1' | 'worker';
  operation: string;
  duration?: number;
  size?: number;
  rowCount?: number;
  success: boolean;
  error?: string;
}

export interface ServiceQuotas {
  r2: {
    operations: number;
    storage: number;
    bandwidth: number;
  };
  kv: {
    reads: number;
    writes: number;
    deletes: number;
    lists: number;
  };
  d1: {
    rowsRead: number;
    rowsWritten: number;
    queries: number;
  };
  worker: {
    cpuTime: number;
    requests: number;
  };
}

export class CloudflareMonitor {
  private metrics: MetricData[] = [];
  private quotas: ServiceQuotas = {
    r2: { operations: 0, storage: 0, bandwidth: 0 },
    kv: { reads: 0, writes: 0, deletes: 0, lists: 0 },
    d1: { rowsRead: 0, rowsWritten: 0, queries: 0 },
    worker: { cpuTime: 0, requests: 0 },
  };

  constructor(private env: CloudflareEnv) {}

  /**
   * Track R2 operation
   */
  trackR2Operation(
    operation: 'get' | 'put' | 'delete' | 'list' | 'head',
    duration: number,
    size?: number,
    success: boolean = true,
    error?: string
  ): void {
    this.metrics.push({
      timestamp: Date.now(),
      service: 'r2',
      operation,
      duration,
      size,
      success,
      error,
    });

    this.quotas.r2.operations++;
    if (size) {
      this.quotas.r2.bandwidth += size;
    }
  }

  /**
   * Track KV operation
   */
  trackKVOperation(
    operation: 'get' | 'put' | 'delete' | 'list',
    duration: number,
    success: boolean = true,
    error?: string
  ): void {
    this.metrics.push({
      timestamp: Date.now(),
      service: 'kv',
      operation,
      duration,
      success,
      error,
    });

    switch (operation) {
      case 'get':
        this.quotas.kv.reads++;
        break;
      case 'put':
        this.quotas.kv.writes++;
        break;
      case 'delete':
        this.quotas.kv.deletes++;
        break;
      case 'list':
        this.quotas.kv.lists++;
        break;
    }
  }

  /**
   * Track D1 query
   */
  trackD1Query(
    operation: string,
    duration: number,
    rowCount: number,
    success: boolean = true,
    error?: string
  ): void {
    this.metrics.push({
      timestamp: Date.now(),
      service: 'd1',
      operation,
      duration,
      rowCount,
      success,
      error,
    });

    this.quotas.d1.queries++;
    this.quotas.d1.rowsRead += rowCount;
  }

  /**
   * Track Worker execution
   */
  trackWorkerExecution(
    operation: string,
    cpuTime: number,
    success: boolean = true,
    error?: string
  ): void {
    this.metrics.push({
      timestamp: Date.now(),
      service: 'worker',
      operation,
      duration: cpuTime,
      success,
      error,
    });

    this.quotas.worker.cpuTime += cpuTime;
    this.quotas.worker.requests++;
  }

  /**
   * Get current quota usage
   */
  getQuotaUsage(): ServiceQuotas {
    return { ...this.quotas };
  }

  /**
   * Get metrics for a specific service
   */
  getServiceMetrics(service: 'r2' | 'kv' | 'd1' | 'worker'): MetricData[] {
    return this.metrics.filter((m) => m.service === service);
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(thresholdMs: number = 1000): MetricData[] {
    return this.metrics.filter(
      (m) => m.duration && m.duration > thresholdMs
    );
  }

  /**
   * Get failed operations
   */
  getFailedOperations(): MetricData[] {
    return this.metrics.filter((m) => !m.success);
  }

  /**
   * Calculate average operation time
   */
  getAverageOperationTime(
    service: 'r2' | 'kv' | 'd1' | 'worker',
    operation?: string
  ): number {
    const filtered = this.metrics.filter(
      (m) =>
        m.service === service &&
        m.duration &&
        (!operation || m.operation === operation)
    );

    if (filtered.length === 0) return 0;

    const total = filtered.reduce((sum, m) => sum + (m.duration || 0), 0);
    return total / filtered.length;
  }

  /**
   * Check if approaching quota limits
   */
  checkQuotaLimits(): {
    service: string;
    metric: string;
    usage: number;
    limit: number;
    percentage: number;
    warning: boolean;
  }[] {
    const warnings: {
      service: string;
      metric: string;
      usage: number;
      limit: number;
      percentage: number;
      warning: boolean;
    }[] = [];

    // R2 limits (free tier)
    const r2OperationsLimit = 1000000; // 1M operations/month
    const r2OperationsPercentage =
      (this.quotas.r2.operations / r2OperationsLimit) * 100;
    if (r2OperationsPercentage > 80) {
      warnings.push({
        service: 'R2',
        metric: 'operations',
        usage: this.quotas.r2.operations,
        limit: r2OperationsLimit,
        percentage: r2OperationsPercentage,
        warning: true,
      });
    }

    // KV limits (free tier)
    const kvReadsLimit = 100000; // 100K reads/day
    const kvReadsPercentage = (this.quotas.kv.reads / kvReadsLimit) * 100;
    if (kvReadsPercentage > 80) {
      warnings.push({
        service: 'KV',
        metric: 'reads',
        usage: this.quotas.kv.reads,
        limit: kvReadsLimit,
        percentage: kvReadsPercentage,
        warning: true,
      });
    }

    const kvWritesLimit = 1000; // 1K writes/day
    const kvWritesPercentage = (this.quotas.kv.writes / kvWritesLimit) * 100;
    if (kvWritesPercentage > 80) {
      warnings.push({
        service: 'KV',
        metric: 'writes',
        usage: this.quotas.kv.writes,
        limit: kvWritesLimit,
        percentage: kvWritesPercentage,
        warning: true,
      });
    }

    // D1 limits (free tier)
    const d1RowsLimit = 5000000; // 5M rows read/day
    const d1RowsPercentage = (this.quotas.d1.rowsRead / d1RowsLimit) * 100;
    if (d1RowsPercentage > 80) {
      warnings.push({
        service: 'D1',
        metric: 'rows_read',
        usage: this.quotas.d1.rowsRead,
        limit: d1RowsLimit,
        percentage: d1RowsPercentage,
        warning: true,
      });
    }

    return warnings;
  }

  /**
   * Generate monitoring report
   */
  generateReport(): {
    summary: {
      totalOperations: number;
      successRate: number;
      averageResponseTime: number;
      slowOperations: number;
      failedOperations: number;
    };
    quotas: ServiceQuotas;
    warnings: ReturnType<typeof this.checkQuotaLimits>;
    slowestOperations: MetricData[];
  } {
    const totalOperations = this.metrics.length;
    const successfulOperations = this.metrics.filter((m) => m.success).length;
    const successRate =
      totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;

    const operationsWithDuration = this.metrics.filter((m) => m.duration);
    const averageResponseTime =
      operationsWithDuration.length > 0
        ? operationsWithDuration.reduce((sum, m) => sum + (m.duration || 0), 0) /
          operationsWithDuration.length
        : 0;

    const slowOperations = this.getSlowOperations(1000);
    const failedOperations = this.getFailedOperations();

    const slowestOperations = [...this.metrics]
      .filter((m) => m.duration)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    return {
      summary: {
        totalOperations,
        successRate,
        averageResponseTime,
        slowOperations: slowOperations.length,
        failedOperations: failedOperations.length,
      },
      quotas: this.getQuotaUsage(),
      warnings: this.checkQuotaLimits(),
      slowestOperations,
    };
  }

  /**
   * Reset metrics (useful for daily/hourly resets)
   */
  reset(): void {
    this.metrics = [];
    this.quotas = {
      r2: { operations: 0, storage: 0, bandwidth: 0 },
      kv: { reads: 0, writes: 0, deletes: 0, lists: 0 },
      d1: { rowsRead: 0, rowsWritten: 0, queries: 0 },
      worker: { cpuTime: 0, requests: 0 },
    };
  }

  /**
   * Persist metrics to KV for long-term storage
   */
  async persistMetrics(): Promise<void> {
    if (!this.env.RESUME_CACHE) return;

    const report = this.generateReport();
    const key = `metrics:${new Date().toISOString().split('T')[0]}`;

    await this.env.RESUME_CACHE.put(key, JSON.stringify(report), {
      expirationTtl: 86400 * 30, // Keep for 30 days
    });
  }

  /**
   * Get historical metrics from KV
   */
  async getHistoricalMetrics(date: string): Promise<any> {
    if (!this.env.RESUME_CACHE) return null;

    const key = `metrics:${date}`;
    const data = await this.env.RESUME_CACHE.get(key);

    return data ? JSON.parse(data) : null;
  }
}

/**
 * Wrapper functions for monitored operations
 */
export class MonitoredOperations {
  constructor(
    private env: CloudflareEnv,
    private monitor: CloudflareMonitor
  ) {}

  /**
   * Monitored R2 get operation
   */
  async r2Get(key: string): Promise<R2ObjectBody | null> {
    const start = Date.now();
    try {
      const result = await this.env.RESUME_BUCKET.get(key);
      const duration = Date.now() - start;
      const size = result ? result.size : 0;
      this.monitor.trackR2Operation('get', duration, size, true);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.monitor.trackR2Operation(
        'get',
        duration,
        0,
        false,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Monitored R2 put operation
   */
  async r2Put(
    key: string,
    value: ArrayBuffer | string,
    options?: R2PutOptions
  ): Promise<R2Object> {
    const start = Date.now();
    const size =
      typeof value === 'string' ? value.length : (value as ArrayBuffer).byteLength;
    try {
      const result = await this.env.RESUME_BUCKET.put(key, value, options);
      const duration = Date.now() - start;
      this.monitor.trackR2Operation('put', duration, size, true);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.monitor.trackR2Operation(
        'put',
        duration,
        size,
        false,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Monitored KV get operation with caching
   */
  async kvGet(key: string, cacheTtl?: number): Promise<string | null> {
    const start = Date.now();
    try {
      const result = await this.env.RESUME_CACHE.get(key, {
        cacheTtl,
      });
      const duration = Date.now() - start;
      this.monitor.trackKVOperation('get', duration, true);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.monitor.trackKVOperation('get', duration, false, (error as Error).message);
      throw error;
    }
  }

  /**
   * Monitored KV put operation
   */
  async kvPut(
    key: string,
    value: string,
    options?: KVNamespacePutOptions
  ): Promise<void> {
    const start = Date.now();
    try {
      await this.env.RESUME_CACHE.put(key, value, options);
      const duration = Date.now() - start;
      this.monitor.trackKVOperation('put', duration, true);
    } catch (error) {
      const duration = Date.now() - start;
      this.monitor.trackKVOperation('put', duration, false, (error as Error).message);
      throw error;
    }
  }

  /**
   * Monitored D1 query operation
   */
  async d1Query<T = unknown>(
    query: string,
    params?: any[]
  ): Promise<D1Result<T>> {
    const start = Date.now();
    try {
      const stmt = params
        ? this.env.DB.prepare(query).bind(...params)
        : this.env.DB.prepare(query);
      const result = await stmt.all<T>();
      const duration = Date.now() - start;
      this.monitor.trackD1Query(
        query.split(' ')[0], // Operation type (SELECT, INSERT, etc.)
        duration,
        result.results?.length || 0,
        true
      );
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.monitor.trackD1Query(
        query.split(' ')[0],
        duration,
        0,
        false,
        (error as Error).message
      );
      throw error;
    }
  }
}
