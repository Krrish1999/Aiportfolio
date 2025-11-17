# Production Migration Checklist

Use this checklist to ensure all steps are completed for the production migration from AWS to Cloudflare.

## Pre-Migration (1-2 weeks before)

### Planning
- [ ] Schedule maintenance window (recommended: 2-4 hours during low-traffic period)
- [ ] Notify all stakeholders of maintenance window
- [ ] Notify users of potential downtime
- [ ] Prepare rollback plan
- [ ] Assign team members to monitoring roles

### Environment Setup
- [ ] Create Cloudflare account (if not already done)
- [ ] Create R2 bucket: `wrangler r2 bucket create ai-resume-storage`
- [ ] Create KV namespace: `wrangler kv:namespace create RESUME_CACHE`
- [ ] Create D1 database: `wrangler d1 create ai-resume-db`
- [ ] Configure wrangler.toml with all bindings
- [ ] Apply D1 schema: `wrangler d1 execute ai-resume-db --file=prisma/migrations/d1_initial_migration.sql`

### Credentials
- [ ] Obtain AWS access keys with S3, PostgreSQL, and Redis access
- [ ] Obtain Cloudflare API token with R2, KV, D1, and Workers access
- [ ] Obtain R2 access keys
- [ ] Store all credentials securely
- [ ] Create `.env.production` file with all required variables

### Testing
- [ ] Run migration test suite: `npm run test:migrations`
- [ ] Test individual migration scripts with sample data
- [ ] Verify rollback mechanisms work correctly
- [ ] Test application functionality in staging environment

### Backups
- [ ] Create full backup of S3 bucket
- [ ] Create full backup of PostgreSQL database
- [ ] Export Redis data
- [ ] Store backups in secure location
- [ ] Verify backup integrity

## Migration Day

### Pre-Migration (T-1 hour)
- [ ] Verify all team members are available
- [ ] Verify monitoring systems are operational
- [ ] Run pre-deployment check: `./scripts/pre-deployment-check.sh`
- [ ] Verify all environment variables are set correctly
- [ ] Test connectivity to AWS and Cloudflare services
- [ ] Put application in maintenance mode (optional)

### Migration Execution (T-0)
- [ ] Load environment variables: `source .env.production`
- [ ] Start migration: `./scripts/production-migration.sh`
- [ ] Monitor migration progress in real-time
- [ ] Watch for errors or warnings
- [ ] Track migration metrics (files transferred, rows migrated, etc.)

### S3 to R2 Migration
- [ ] Migration started successfully
- [ ] Files are being transferred
- [ ] Checksums are being verified
- [ ] Progress is being logged
- [ ] Migration completed without errors
- [ ] Verify file count matches: Expected vs Actual

### PostgreSQL to D1 Migration
- [ ] Migration started successfully
- [ ] Tables are being exported
- [ ] Data is being transformed
- [ ] Data is being imported to D1
- [ ] Referential integrity is verified
- [ ] Migration completed without errors
- [ ] Verify row count matches: Expected vs Actual

### Redis to KV Migration
- [ ] Migration started successfully
- [ ] Jobs are being exported from Redis
- [ ] Jobs are being imported to KV
- [ ] Active jobs are recreated in Durable Objects
- [ ] Migration completed without errors
- [ ] Verify job count matches: Expected vs Actual

### Data Verification
- [ ] S3 to R2: 100% of files transferred and verified
- [ ] PostgreSQL to D1: 100% of rows transferred and verified
- [ ] Redis to KV: All jobs transferred and accessible
- [ ] No data corruption detected
- [ ] Checksums match for all files
- [ ] Sample records verified in D1

### Application Testing
- [ ] File upload test passed
- [ ] Job processing test passed
- [ ] Database operations test passed
- [ ] Deployment test passed
- [ ] Manual smoke test: Upload resume
- [ ] Manual smoke test: Parse resume
- [ ] Manual smoke test: Customize portfolio
- [ ] Manual smoke test: Deploy portfolio

## Post-Migration (Immediate)

### Verification (T+1 hour)
- [ ] Review migration report: `logs/production-migration-report.json`
- [ ] Check for any errors or warnings
- [ ] Verify all migration steps completed successfully
- [ ] Verify application is accessible
- [ ] Test critical user flows
- [ ] Monitor error rates
- [ ] Monitor performance metrics

### Monitoring Setup
- [ ] Configure Cloudflare Analytics
- [ ] Set up alerts for R2 operations
- [ ] Set up alerts for KV operations
- [ ] Set up alerts for D1 queries
- [ ] Set up alerts for Workers errors
- [ ] Set up alerts for quota limits
- [ ] Monitor application logs

### Communication
- [ ] Notify stakeholders of migration completion
- [ ] Notify users that service is restored
- [ ] Document any issues encountered
- [ ] Share migration report with team

## Post-Migration (7-Day Monitoring Period)

### Daily Checks (Days 1-7)
- [ ] Day 1: Check error logs
- [ ] Day 1: Monitor performance metrics
- [ ] Day 1: Verify no user-reported issues
- [ ] Day 2: Check error logs
- [ ] Day 2: Monitor performance metrics
- [ ] Day 2: Verify no user-reported issues
- [ ] Day 3: Check error logs
- [ ] Day 3: Monitor performance metrics
- [ ] Day 3: Verify no user-reported issues
- [ ] Day 4: Check error logs
- [ ] Day 4: Monitor performance metrics
- [ ] Day 4: Verify no user-reported issues
- [ ] Day 5: Check error logs
- [ ] Day 5: Monitor performance metrics
- [ ] Day 5: Verify no user-reported issues
- [ ] Day 6: Check error logs
- [ ] Day 6: Monitor performance metrics
- [ ] Day 6: Verify no user-reported issues
- [ ] Day 7: Check error logs
- [ ] Day 7: Monitor performance metrics
- [ ] Day 7: Verify no user-reported issues

### Weekly Review (End of Week 1)
- [ ] Review Cloudflare Analytics dashboard
- [ ] Compare performance metrics: Before vs After
- [ ] Review all error logs
- [ ] Review user feedback
- [ ] Verify data consistency
- [ ] Check resource usage and costs
- [ ] Document any optimizations needed

## AWS Decommissioning (After 7 Days)

### Pre-Decommissioning
- [ ] Verify 7 days of stable operation
- [ ] Verify no errors or data issues
- [ ] Verify user satisfaction
- [ ] Get approval from stakeholders
- [ ] Create final backup of AWS data

### Decommissioning Steps
- [ ] Run task 15: Decommission AWS infrastructure
- [ ] Delete all objects from S3 bucket
- [ ] Delete S3 bucket
- [ ] Terminate PostgreSQL database instance
- [ ] Terminate Redis instance
- [ ] Remove AWS credentials from environment
- [ ] Remove AWS SDK packages from package.json
- [ ] Update documentation to reflect Cloudflare-only infrastructure

### Final Verification
- [ ] Verify application still works without AWS
- [ ] Verify no AWS API calls in logs
- [ ] Verify all features working correctly
- [ ] Update architecture diagrams
- [ ] Update deployment documentation
- [ ] Update team runbooks

## Rollback Procedure (If Needed)

### Immediate Rollback
- [ ] Stop migration if in progress
- [ ] Run rollback scripts
- [ ] Clear Cloudflare data (R2, KV, D1)
- [ ] Switch DNS back to AWS
- [ ] Verify application works on AWS
- [ ] Notify stakeholders of rollback
- [ ] Document issues encountered

### Investigation
- [ ] Review migration logs
- [ ] Identify root cause of failure
- [ ] Document lessons learned
- [ ] Plan fixes for next attempt
- [ ] Schedule new migration window

## Notes

### Migration Metrics
- Total files migrated: _______
- Total database rows migrated: _______
- Total jobs migrated: _______
- Migration duration: _______ minutes
- Downtime: _______ minutes

### Issues Encountered
- Issue 1: _______________________________
- Resolution: _____________________________
- Issue 2: _______________________________
- Resolution: _____________________________

### Team Members
- Migration Lead: _______________________
- Database Admin: _______________________
- DevOps Engineer: ______________________
- QA Engineer: __________________________
- On-Call Support: _______________________

### Contact Information
- Cloudflare Support: support@cloudflare.com
- AWS Support: _______________________
- Internal Escalation: _______________________

### Important Links
- Migration Report: `logs/production-migration-report.json`
- Cloudflare Dashboard: https://dash.cloudflare.com
- AWS Console: https://console.aws.amazon.com
- Monitoring Dashboard: _______________________
- Status Page: _______________________
