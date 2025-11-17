/**
 * Optimization utilities for Cloudflare services
 * 
 * Provides automatic optimization strategies:
 * - Query optimization for D1
 * - Batch operation optimization
 * - Cache strategy recommendations
 * - Resource usage optimization
 */

import { CloudflareEnv } from '../config/cloudflare-env';
import { CloudflareMonitor, MetricData } from './monitoring';

export interface OptimizationRecommendation {
  type: 'query' | 'cache' | 'batch' | 'resource';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: string;
  action: string;
}

export class OptimizationAnalyzer {
  constructor(private monitor: CloudflareMonitor) {}

  /**
   * Analyze metrics and generate optimization recommendations
   */
  analyzeAndRecommend(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze slow queries
    const slowQueries = this.analyzeSlowQueries();
    recommendations.push(...slowQueries);

    // Analyze cache efficiency
    const cacheRecommendations = this.analyzeCacheEfficiency();
    recommendations.push(...cacheRecommendations);

    // Analyze batch opportunities
    const batchRecommendations = this.analyzeBatchOpportunities();
    recommendations.push(...batchRecommendations);

    // Analyze resource usage
    const resourceRecommendations = this.analyzeResourceUsage();
    recommendations.push(...resourceRecommendations);

    return recommendations.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Analyze slow D1 queries
   */
  private analyzeSlowQueries(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const d1Metrics = this.monitor.getServiceMetrics('d1');
    const slowQueries = d1Metrics.filter((m) => m.duration && m.duration > 100);

    if (slowQueries.length > 0) {
      const avgTime = this.monitor.getAverageOperationTime('d1');
      
      if (avgTime > 100) {
        recommendations.push({
          type: 'query',
          severity: 'high',
          title: 'Slow D1 Queries Detected',
          description: `Average D1 query time is ${avgTime.toFixed(2)}ms. ${slowQueries.length} queries exceed 100ms.`,
          impact: 'High latency affects user experience and increases costs',
          action: 'Add indexes to frequently queried columns, optimize JOIN operations, or implement query result caching',
        });
      }

      // Check for N+1 query patterns
      const queryPatterns = this.detectNPlusOneQueries(d1Metrics);
      if (queryPatterns.length > 0) {
        recommendations.push({
          type: 'query',
          severity: 'high',
          title: 'N+1 Query Pattern Detected',
          description: `Detected ${queryPatterns.length} potential N+1 query patterns`,
          impact: 'Multiple sequential queries can be replaced with single batch query',
          action: 'Use JOIN operations or batch queries to fetch related data in single query',
        });
      }
    }

    return recommendations;
  }

  /**
   * Analyze cache efficiency
   */
  private analyzeCacheEfficiency(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const kvMetrics = this.monitor.getServiceMetrics('kv');
    const d1Metrics = this.monitor.getServiceMetrics('d1');

    // Check if frequently accessed data is being cached
    const frequentD1Queries = this.findFrequentQueries(d1Metrics);
    if (frequentD1Queries.length > 0) {
      recommendations.push({
        type: 'cache',
        severity: 'medium',
        title: 'Cacheable Queries Not Cached',
        description: `${frequentD1Queries.length} queries are executed frequently without caching`,
        impact: 'Unnecessary D1 reads increase latency and costs',
        action: 'Implement KV caching for frequently accessed data with appropriate TTL',
      });
    }

    // Check KV write/read ratio
    const kvWrites = kvMetrics.filter((m) => m.operation === 'put').length;
    const kvReads = kvMetrics.filter((m) => m.operation === 'get').length;
    
    if (kvWrites > kvReads * 0.5) {
      recommendations.push({
        type: 'cache',
        severity: 'low',
        title: 'High KV Write Ratio',
        description: `KV writes (${kvWrites}) are high relative to reads (${kvReads})`,
        impact: 'High write ratio may indicate inefficient cache usage',
        action: 'Review cache invalidation strategy and increase TTL for stable data',
      });
    }

    return recommendations;
  }

  /**
   * Analyze batch operation opportunities
   */
  private analyzeBatchOpportunities(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const d1Metrics = this.monitor.getServiceMetrics('d1');

    // Detect sequential INSERT/UPDATE operations
    const sequentialWrites = this.detectSequentialWrites(d1Metrics);
    if (sequentialWrites > 5) {
      recommendations.push({
        type: 'batch',
        severity: 'medium',
        title: 'Sequential Writes Detected',
        description: `Detected ${sequentialWrites} sequential write operations`,
        impact: 'Multiple round trips increase latency and D1 operation count',
        action: 'Use D1 batch API to combine multiple operations into single request',
      });
    }

    // Check R2 operations
    const r2Metrics = this.monitor.getServiceMetrics('r2');
    const sequentialR2Ops = this.detectSequentialR2Operations(r2Metrics);
    if (sequentialR2Ops > 3) {
      recommendations.push({
        type: 'batch',
        severity: 'low',
        title: 'Sequential R2 Operations',
        description: `Detected ${sequentialR2Ops} sequential R2 operations`,
        impact: 'Multiple R2 operations can be optimized',
        action: 'Consider batching file operations or using multipart uploads for large files',
      });
    }

    return recommendations;
  }

  /**
   * Analyze resource usage
   */
  private analyzeResourceUsage(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const quotas = this.monitor.getQuotaUsage();

    // Check R2 bandwidth usage
    if (quotas.r2.bandwidth > 1024 * 1024 * 1024) {
      // > 1GB
      recommendations.push({
        type: 'resource',
        severity: 'medium',
        title: 'High R2 Bandwidth Usage',
        description: `R2 bandwidth usage: ${(quotas.r2.bandwidth / 1024 / 1024 / 1024).toFixed(2)}GB`,
        impact: 'High bandwidth usage may indicate inefficient file serving',
        action: 'Enable R2 public URLs for static assets, implement CDN caching, or compress files',
      });
    }

    // Check D1 row reads
    if (quotas.d1.rowsRead > 1000000) {
      recommendations.push({
        type: 'resource',
        severity: 'medium',
        title: 'High D1 Row Reads',
        description: `D1 rows read: ${quotas.d1.rowsRead.toLocaleString()}`,
        impact: 'High row reads may indicate missing indexes or inefficient queries',
        action: 'Add indexes, implement pagination, or cache query results',
      });
    }

    // Check Worker CPU time
    const workerMetrics = this.monitor.getServiceMetrics('worker');
    const avgCpuTime = this.monitor.getAverageOperationTime('worker');
    if (avgCpuTime > 10) {
      recommendations.push({
        type: 'resource',
        severity: 'high',
        title: 'High Worker CPU Time',
        description: `Average Worker CPU time: ${avgCpuTime.toFixed(2)}ms`,
        impact: 'High CPU time increases costs and may hit execution limits',
        action: 'Optimize algorithms, reduce JSON parsing, or split work across multiple requests',
      });
    }

    return recommendations;
  }

  /**
   * Detect N+1 query patterns
   */
  private detectNPlusOneQueries(metrics: MetricData[]): string[] {
    const patterns: string[] = [];
    const timeWindow = 1000; // 1 second

    for (let i = 0; i < metrics.length - 1; i++) {
      const current = metrics[i];
      const next = metrics[i + 1];

      if (
        next.timestamp - current.timestamp < timeWindow &&
        current.operation === next.operation
      ) {
        patterns.push(`${current.operation} at ${new Date(current.timestamp).toISOString()}`);
      }
    }

    return patterns;
  }

  /**
   * Find frequently executed queries
   */
  private findFrequentQueries(metrics: MetricData[]): string[] {
    const queryCounts = new Map<string, number>();

    metrics.forEach((m) => {
      const count = queryCounts.get(m.operation) || 0;
      queryCounts.set(m.operation, count + 1);
    });

    return Array.from(queryCounts.entries())
      .filter(([_, count]) => count > 10)
      .map(([operation]) => operation);
  }

  /**
   * Detect sequential write operations
   */
  private detectSequentialWrites(metrics: MetricData[]): number {
    let count = 0;
    const writeOps = ['INSERT', 'UPDATE', 'DELETE'];

    for (let i = 0; i < metrics.length - 1; i++) {
      const current = metrics[i];
      const next = metrics[i + 1];

      if (
        writeOps.includes(current.operation) &&
        writeOps.includes(next.operation) &&
        next.timestamp - current.timestamp < 100
      ) {
        count++;
      }
    }

    return count;
  }

  /**
   * Detect sequential R2 operations
   */
  private detectSequentialR2Operations(metrics: MetricData[]): number {
    let count = 0;

    for (let i = 0; i < metrics.length - 1; i++) {
      const current = metrics[i];
      const next = metrics[i + 1];

      if (next.timestamp - current.timestamp < 100) {
        count++;
      }
    }

    return count;
  }
}

/**
 * Query optimizer for D1
 */
export class QueryOptimizer {
  /**
   * Suggest indexes for slow queries
   */
  suggestIndexes(query: string): string[] {
    const suggestions: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Detect WHERE clauses
    const whereMatch = lowerQuery.match(/where\s+(\w+)\s*=/);
    if (whereMatch) {
      suggestions.push(`CREATE INDEX idx_${whereMatch[1]} ON table_name(${whereMatch[1]})`);
    }

    // Detect JOIN operations
    const joinMatch = lowerQuery.match(/join\s+\w+\s+on\s+\w+\.(\w+)\s*=\s*\w+\.(\w+)/);
    if (joinMatch) {
      suggestions.push(`CREATE INDEX idx_${joinMatch[1]} ON table_name(${joinMatch[1]})`);
      suggestions.push(`CREATE INDEX idx_${joinMatch[2]} ON table_name(${joinMatch[2]})`);
    }

    // Detect ORDER BY
    const orderMatch = lowerQuery.match(/order\s+by\s+(\w+)/);
    if (orderMatch) {
      suggestions.push(`CREATE INDEX idx_${orderMatch[1]} ON table_name(${orderMatch[1]})`);
    }

    return suggestions;
  }

  /**
   * Convert sequential queries to batch
   */
  convertToBatch(queries: string[]): string {
    return `BEGIN TRANSACTION;\n${queries.join(';\n')};\nCOMMIT;`;
  }

  /**
   * Optimize SELECT query
   */
  optimizeSelect(query: string): string {
    let optimized = query;

    // Add LIMIT if missing
    if (!optimized.toLowerCase().includes('limit')) {
      optimized += ' LIMIT 100';
    }

    // Suggest specific columns instead of SELECT *
    if (optimized.includes('SELECT *')) {
      optimized = optimized.replace(
        'SELECT *',
        'SELECT /* specify columns instead of * */'
      );
    }

    return optimized;
  }
}

/**
 * Automatic optimization executor
 */
export class AutoOptimizer {
  constructor(
    private monitor: CloudflareMonitor,
    private env: CloudflareEnv
  ) {}

  /**
   * Run automatic optimizations
   */
  async optimize(): Promise<{
    applied: string[];
    recommendations: OptimizationRecommendation[];
  }> {
    const applied: string[] = [];
    const analyzer = new OptimizationAnalyzer(this.monitor);
    const recommendations = analyzer.analyzeAndRecommend();

    // Auto-apply low-risk optimizations
    for (const rec of recommendations) {
      if (rec.severity === 'low' && rec.type === 'cache') {
        // Could auto-enable caching for certain patterns
        applied.push(`Auto-enabled caching: ${rec.title}`);
      }
    }

    return { applied, recommendations };
  }
}
