# Cloudflare Monitoring and Optimization Guide

This guide explains how to monitor and optimize your Cloudflare deployment for the AI Resume Portfolio application.

## Table of Contents

1. [Overview](#overview)
2. [Setting Up Monitoring](#setting-up-monitoring)
3. [Analytics API](#analytics-api)
4. [Monitoring Metrics](#monitoring-metrics)
5. [Quota Management](#quota-management)
6. [Performance Optimization](#performance-optimization)
7. [Caching Strategies](#caching-strategies)
8. [Alerts and Notifications](#alerts-and-notifications)
9. [Troubleshooting](#troubleshooting)

## Overview

The monitoring system tracks:
- **R2**: Operation counts, bandwidth usage, storage costs
- **KV**: Read/write operations, quota usage
- **D1**: Query performance, row counts, slow queries
- **Workers**: CPU time, memory usage, request counts

## Setting Up Monitoring

### 1. Run Setup Script

```bash
./scripts/setup-analytics.sh
```

This script:
- Fetches current analytics data
- Sets up notification webhooks (if configured)
- Creates custom analytics namespace
- Displays access URLs

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Optional: Slack webhook for alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optional: Email for critical alerts
ALERT_EMAIL=admin@example.com
```

### 3. Enable Analytics in Code

The monitoring system is automatically initialized when using the monitored service wrappers:

```typescript
import { CloudflareMonitor, MonitoredOperations } from './utils/monitoring';
import { getCloudflareEnv } from './config/cloudflare-env';

const env = getCloudflareEnv();
const monitor = new CloudflareMonitor(env);
const ops = new MonitoredOperations(env, monitor);

// All operations are automatically tracked
await ops.r2Get('file-key');
await ops.kvGet('cache-key');
await ops.d1Query('SELECT * FROM users WHERE id = ?', [userId]);
```

## Analytics API

### Endpoints

#### Get Full Report
```bash
GET /api/analytics?action=report
```

Returns:
```json
{
  "summary": {
    "totalOperations": 1234,
    "successRate": 99.5,
    "averageResponseTime": 45.2,
    "slowOperations": 12,
    "failedOperations": 6
  },
  "quotas": {
    "r2": { "operations": 50000, "storage": 1024000, "bandwidth": 5120000 },
    "kv": { "reads": 25000, "writes": 500, "deletes": 100, "lists": 50 },
    "d1": { "rowsRead": 100000, "rowsWritten": 5000, "queries": 2500 },
    "worker": { "cpuTime": 12500, "requests": 5000 }
  },
  "warnings": [...],
  "slowestOperations": [...]
}
```

#### Get Current Quotas
```bash
GET /api/analytics?action=quotas
```

#### Get Slow Operations
```bash
GET /api/analytics?action=slow&threshold=1000
```

#### Get Failed Operations
```bash
GET /api/analytics?action=failed
```

#### Get Quota Warnings
```bash
GET /api/analytics?action=warnings
```

#### Get Historical Metrics
```bash
GET /api/analytics?action=historical&date=2024-01-15
```

### Admin Actions

#### Reset Metrics
```bash
POST /api/analytics
Content-Type: application/json

{
  "action": "reset"
}
```

#### Persist Metrics to KV
```bash
POST /api/analytics
Content-Type: application/json

{
  "action": "persist"
}
```

## Monitoring Metrics

### R2 Metrics

**What to Monitor:**
- Operation count (Class A: PUT, DELETE; Class B: GET, HEAD)
- Bandwidth usage (egress)
- Storage size
- Average operation time

**Free Tier Limits:**
- 1M Class A operations/month
- 10M Class B operations/month
- 10GB storage
- No egress charges

**Optimization Tips:**
- Use R2 public URLs for static assets
- Enable browser caching with appropriate headers
- Compress files before upload
- Use multipart uploads for large files (>100MB)

### KV Metrics

**What to Monitor:**
- Read operations per day
- Write operations per day
- Delete operations per day
- List operations per day
- Cache hit rate

**Free Tier Limits:**
- 100K reads/day
- 1K writes/day
- 1K deletes/day
- 1K lists/day
- 1GB storage

**Optimization Tips:**
- Increase TTL for stable data
- Use memory cache before KV
- Batch operations when possible
- Implement cache warming for frequently accessed data

### D1 Metrics

**What to Monitor:**
- Query execution time
- Rows read per day
- Rows written per day
- Query count
- Slow queries (>100ms)

**Free Tier Limits:**
- 5M rows read/day
- 100K rows written/day
- 5GB storage

**Optimization Tips:**
- Add indexes to frequently queried columns
- Use prepared statements
- Implement query result caching
- Use batch operations for bulk inserts
- Avoid SELECT * queries
- Implement pagination

### Worker Metrics

**What to Monitor:**
- CPU time per request
- Memory usage
- Request count
- Cold start frequency
- Error rate

**Free Tier Limits:**
- 100K requests/day
- 10ms CPU time per request (free tier)
- 128MB memory

**Optimization Tips:**
- Minimize JSON parsing
- Use streaming for large responses
- Implement request coalescing
- Optimize algorithms
- Split long operations across multiple requests

## Quota Management

### Checking Quota Usage

```typescript
import { CloudflareMonitor } from './utils/monitoring';

const monitor = new CloudflareMonitor(env);
const quotas = monitor.getQuotaUsage();

console.log('R2 Operations:', quotas.r2.operations);
console.log('KV Reads:', quotas.kv.reads);
console.log('D1 Rows Read:', quotas.d1.rowsRead);
```

### Quota Warnings

The system automatically checks for quota limits and warns when usage exceeds 80%:

```typescript
const warnings = monitor.checkQuotaLimits();

warnings.forEach(warning => {
  console.log(`⚠️  ${warning.service} ${warning.metric}: ${warning.percentage.toFixed(1)}%`);
});
```

### Setting Up Alerts

Configure alerts in `scripts/setup-analytics.sh` or manually via Cloudflare Dashboard:

1. Go to Cloudflare Dashboard → Account → Notifications
2. Create new notification
3. Select trigger (e.g., "R2 quota exceeded")
4. Set threshold (e.g., 80%)
5. Add webhook or email destination

## Performance Optimization

### Automatic Optimization

```typescript
import { OptimizationAnalyzer, AutoOptimizer } from './utils/optimization';

const analyzer = new OptimizationAnalyzer(monitor);
const recommendations = analyzer.analyzeAndRecommend();

recommendations.forEach(rec => {
  console.log(`[${rec.severity}] ${rec.title}`);
  console.log(`  ${rec.description}`);
  console.log(`  Action: ${rec.action}`);
});

// Auto-apply safe optimizations
const optimizer = new AutoOptimizer(monitor, env);
const result = await optimizer.optimize();
console.log('Applied optimizations:', result.applied);
```

### Query Optimization

```typescript
import { QueryOptimizer } from './utils/optimization';

const optimizer = new QueryOptimizer();

// Get index suggestions
const indexes = optimizer.suggestIndexes('SELECT * FROM users WHERE email = ?');
console.log('Suggested indexes:', indexes);

// Convert sequential queries to batch
const batch = optimizer.convertToBatch([
  'INSERT INTO users (id, email) VALUES (1, "a@example.com")',
  'INSERT INTO users (id, email) VALUES (2, "b@example.com")',
]);
console.log('Batch query:', batch);
```

### Identifying Slow Operations

```bash
# Get operations slower than 1 second
curl http://localhost:3000/api/analytics?action=slow&threshold=1000
```

Common causes:
- Missing database indexes
- N+1 query patterns
- Large file transfers without streaming
- Unoptimized algorithms
- Excessive JSON parsing

## Caching Strategies

### Multi-Tier Caching

```typescript
import { CacheManager, CachingStrategies } from './utils/caching';

const cacheManager = new CacheManager(env);
const strategies = new CachingStrategies(cacheManager);

// Cache user data (1 hour TTL)
const user = await strategies.cacheUser(userId, async () => {
  return await db.getUser(userId);
});

// Cache resume session (30 minute TTL)
const session = await strategies.cacheResumeSession(sessionId, async () => {
  return await db.getSession(sessionId);
});

// Cache AI-generated content (7 day TTL)
const content = await strategies.cacheAIContent(contentHash, async () => {
  return await aiService.generate(prompt);
});
```

### Cache Invalidation

```typescript
// Invalidate specific cache
await cacheManager.invalidate('user:123');

// Invalidate by tags
await cacheManager.invalidateByTags(['user:123', 'session:456']);

// Invalidate using strategies
await strategies.invalidateUser(userId);
await strategies.invalidateSession(sessionId);
```

### Cache Warming

```typescript
import { CacheWarmer } from './utils/caching';

const warmer = new CacheWarmer(cacheManager, strategies);

// Warm cache for frequently accessed data
await warmer.warmCache({
  users: ['user1', 'user2', 'user3'],
  sessions: ['session1', 'session2'],
  portfolios: ['portfolio1', 'portfolio2'],
});
```

## Alerts and Notifications

### Slack Notifications

Set up Slack webhook in `.env`:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

The system will send alerts for:
- Quota warnings (>80% usage)
- High error rates (>5%)
- Slow operations (>1s)
- Service failures

### Email Alerts

Configure email alerts via Cloudflare Dashboard:

1. Go to Account → Notifications
2. Add email destination
3. Create policies for:
   - R2 quota exceeded
   - KV quota exceeded
   - D1 quota exceeded
   - Worker errors

### Custom Webhooks

Create custom webhook handlers:

```typescript
// In your webhook endpoint
export async function POST(request: Request) {
  const alert = await request.json();
  
  if (alert.type === 'quota_warning') {
    // Handle quota warning
    await notifyTeam(alert);
  }
  
  return new Response('OK');
}
```

## Troubleshooting

### High R2 Operation Count

**Symptoms:**
- Approaching 1M operations/month
- High costs

**Solutions:**
1. Enable R2 public URLs for static assets
2. Implement CDN caching
3. Reduce file metadata checks
4. Batch file operations

### High KV Write Count

**Symptoms:**
- Approaching 1K writes/day
- Frequent cache invalidation

**Solutions:**
1. Increase cache TTL
2. Reduce cache invalidation frequency
3. Use memory cache before KV
4. Batch cache updates

### Slow D1 Queries

**Symptoms:**
- Queries taking >100ms
- High row read count

**Solutions:**
1. Add indexes to queried columns
2. Implement query result caching
3. Use pagination
4. Optimize JOIN operations
5. Avoid SELECT * queries

### High Worker CPU Time

**Symptoms:**
- Approaching 10ms CPU limit
- Slow response times

**Solutions:**
1. Optimize algorithms
2. Reduce JSON parsing
3. Use streaming for large data
4. Split work across multiple requests
5. Implement request coalescing

### Memory Issues

**Symptoms:**
- Worker memory errors
- Crashes under load

**Solutions:**
1. Process data in chunks
2. Use streaming APIs
3. Avoid loading large files into memory
4. Implement pagination
5. Clear references to allow GC

## Best Practices

1. **Monitor Daily**: Check analytics dashboard daily for anomalies
2. **Set Alerts**: Configure alerts for 80% quota usage
3. **Cache Aggressively**: Cache frequently accessed data
4. **Optimize Queries**: Add indexes and use prepared statements
5. **Batch Operations**: Combine multiple operations when possible
6. **Use Streaming**: Stream large files instead of buffering
7. **Implement Pagination**: Limit query results
8. **Review Metrics**: Weekly review of slow operations and errors
9. **Test Optimizations**: Measure impact of optimizations
10. **Document Changes**: Keep track of optimization changes

## Resources

- [Cloudflare Analytics Dashboard](https://dash.cloudflare.com)
- [Workers Analytics](https://developers.cloudflare.com/workers/observability/analytics-engine/)
- [R2 Metrics](https://developers.cloudflare.com/r2/observability/)
- [D1 Metrics](https://developers.cloudflare.com/d1/observability/)
- [KV Limits](https://developers.cloudflare.com/kv/platform/limits/)

## Support

For issues or questions:
1. Check Cloudflare Status: https://www.cloudflarestatus.com/
2. Review Cloudflare Docs: https://developers.cloudflare.com/
3. Contact Cloudflare Support: https://dash.cloudflare.com/support
