# Cloudflare Monitoring - Quick Reference

## Quick Start

### 1. Setup Analytics
```bash
./scripts/setup-analytics.sh
```

### 2. Check Current Status
```bash
curl http://localhost:3000/api/analytics?action=report | jq
```

### 3. View Quota Usage
```bash
curl http://localhost:3000/api/analytics?action=quotas | jq
```

## Common Commands

### Get Slow Operations (>1s)
```bash
curl "http://localhost:3000/api/analytics?action=slow&threshold=1000" | jq
```

### Get Failed Operations
```bash
curl http://localhost:3000/api/analytics?action=failed | jq
```

### Get Quota Warnings
```bash
curl http://localhost:3000/api/analytics?action=warnings | jq
```

### View Historical Metrics
```bash
curl "http://localhost:3000/api/analytics?action=historical&date=2024-01-15" | jq
```

### Reset Metrics
```bash
curl -X POST http://localhost:3000/api/analytics \
  -H "Content-Type: application/json" \
  -d '{"action": "reset"}'
```

### Persist Metrics to KV
```bash
curl -X POST http://localhost:3000/api/analytics \
  -H "Content-Type: application/json" \
  -d '{"action": "persist"}'
```

## Code Examples

### Basic Monitoring
```typescript
import { CloudflareMonitor } from '@/utils/monitoring';
import { getCloudflareEnv } from '@/config/cloudflare-env';

const env = getCloudflareEnv();
const monitor = new CloudflareMonitor(env);

// Track operations
monitor.trackR2Operation('get', 50, 1024, true);
monitor.trackKVOperation('get', 10, true);
monitor.trackD1Query('SELECT', 30, 10, true);

// Get report
const report = monitor.generateReport();
console.log(`Success Rate: ${report.summary.successRate}%`);
console.log(`Avg Response: ${report.summary.averageResponseTime}ms`);
```

### Using Monitored Services
```typescript
import { MonitoredServiceFactory } from '@/utils/monitored-services';

const factory = new MonitoredServiceFactory(env);

// All operations are automatically monitored
const fileStorage = factory.createFileStorage();
const database = factory.createDatabase();
const queue = factory.createQueue();

// Use services normally
await fileStorage.uploadFile(buffer, 'file.pdf', 'application/pdf');
await database.getUser('user-123');

// Get monitoring report
const report = factory.getReport();
```

### Caching
```typescript
import { CacheManager, CachingStrategies } from '@/utils/caching';

const cache = new CacheManager(env);
const strategies = new CachingStrategies(cache);

// Cache with automatic TTL
const user = await strategies.cacheUser('user-123', async () => {
  return await db.getUser('user-123');
});

// Invalidate cache
await strategies.invalidateUser('user-123');
```

### Optimization Analysis
```typescript
import { OptimizationAnalyzer } from '@/utils/optimization';

const analyzer = new OptimizationAnalyzer(monitor);
const recommendations = analyzer.analyzeAndRecommend();

// Print recommendations
recommendations.forEach(rec => {
  console.log(`[${rec.severity.toUpperCase()}] ${rec.title}`);
  console.log(`  ${rec.description}`);
  console.log(`  Action: ${rec.action}\n`);
});
```

## Quota Limits (Free Tier)

| Service | Metric | Limit | Warning At |
|---------|--------|-------|------------|
| R2 | Operations | 1M/month | 800K |
| R2 | Storage | 10GB | 8GB |
| KV | Reads | 100K/day | 80K |
| KV | Writes | 1K/day | 800 |
| D1 | Rows Read | 5M/day | 4M |
| D1 | Rows Written | 100K/day | 80K |
| Workers | Requests | 100K/day | 80K |
| Workers | CPU Time | 10ms/request | 8ms |

## Optimization Checklist

### Daily
- [ ] Check quota warnings
- [ ] Review failed operations
- [ ] Monitor slow operations (>1s)

### Weekly
- [ ] Review optimization recommendations
- [ ] Analyze cache hit rates
- [ ] Check for N+1 query patterns
- [ ] Review resource usage trends

### Monthly
- [ ] Apply optimization recommendations
- [ ] Review and adjust cache TTLs
- [ ] Add indexes for slow queries
- [ ] Analyze historical metrics

## Common Issues

### High R2 Operations
**Solution:** Enable R2 public URLs, implement CDN caching, reduce metadata checks

### High KV Writes
**Solution:** Increase cache TTL, reduce invalidation frequency, use memory cache

### Slow D1 Queries
**Solution:** Add indexes, implement query caching, use pagination, optimize JOINs

### High Worker CPU Time
**Solution:** Optimize algorithms, reduce JSON parsing, use streaming, split operations

## Alert Configuration

### Slack Webhook
```bash
# Add to .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Email Alerts
Configure in Cloudflare Dashboard:
1. Go to Account → Notifications
2. Add email destination
3. Create policies for quota warnings

## Useful Links

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Workers Analytics**: https://dash.cloudflare.com/[account]/workers/analytics
- **R2 Metrics**: https://dash.cloudflare.com/[account]/r2
- **Full Guide**: See MONITORING_GUIDE.md

## Support

For detailed information, see:
- `MONITORING_GUIDE.md` - Comprehensive guide
- `src/utils/monitoring.ts` - Monitoring implementation
- `src/utils/caching.ts` - Caching strategies
- `src/utils/optimization.ts` - Optimization utilities
