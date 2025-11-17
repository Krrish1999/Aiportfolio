#!/usr/bin/env node

/**
 * Redis to KV/Durable Objects Migration Script
 * 
 * This script migrates job queue data from Redis to Cloudflare KV and Durable Objects:
 * - Export active job states from Redis
 * - Transform Redis job data to Durable Object format
 * - Import job states to KV for caching
 * - Recreate active jobs in Durable Objects
 * - Verify all jobs are accessible after migration
 * 
 * Requirements: 11.3, 11.4
 */

import Redis from 'ioredis';
import { existsSync, mkdirSync, writeFileSync, createWriteStream } from 'fs';
import { join } from 'path';

// Configuration
interface MigrationConfig {
  // Redis Configuration
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisDb: number;
  
  // Cloudflare Configuration
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  kvNamespaceId: string;
  workerName: string;
  
  // Migration Settings
  exportDir: string;
  logFile: string;
  verifyJobs: boolean;
}

interface RedisJobData {
  id: string;
  name: string;
  data: any;
  opts: any;
  progress: number;
  delay: number;
  timestamp: number;
  attemptsMade: number;
  stacktrace: string[];
  returnvalue: any;
  finishedOn: number | null;
  processedOn: number | null;
}

interface DurableObjectJobData {
  sessionId: string;
  fileKey: string;
  userId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
  result?: any;
}

interface MigrationSummary {
  startTime: string;
  endTime?: string;
  totalRedisJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  migratedToKV: number;
  migratedToDO: number;
  verifiedJobs: number;
  success: boolean;
  errors: string[];
}

class RedisToKVMigrator {
  private redisClient: Redis;
  private config: MigrationConfig;
  private summary: MigrationSummary;
  private logStream: any;

  constructor(config: MigrationConfig) {
    this.config = config;
    
    // Initialize Redis client
    this.redisClient = new Redis({
      host: config.redisHost,
      port: config.redisPort,
      password: config.redisPassword,
      db: config.redisDb,
    });
    
    // Initialize summary
    this.summary = {
      startTime: new Date().toISOString(),
      totalRedisJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      migratedToKV: 0,
      migratedToDO: 0,
      verifiedJobs: 0,
      success: false,
      errors: [],
    };
    
    // Setup logging
    this.setupLogging();
  }

  private setupLogging(): void {
    const logDir = join(process.cwd(), 'logs');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    
    this.logStream = createWriteStream(this.config.logFile, { flags: 'a' });
    this.log('INFO', '='.repeat(80));
    this.log('INFO', 'Redis to KV/Durable Objects Migration Started');
    this.log('INFO', `Source: Redis ${this.config.redisHost}:${this.config.redisPort}`);
    this.log('INFO', `Target: KV Namespace ${this.config.kvNamespaceId}`);
    this.log('INFO', '='.repeat(80));
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    if (this.logStream) {
      this.logStream.write(logMessage + '\n');
    }
  }

  async connect(): Promise<void> {
    this.log('INFO', 'Connecting to Redis...');
    await this.redisClient.ping();
    this.log('INFO', 'Connected to Redis');
  }

  async disconnect(): Promise<void> {
    await this.redisClient.quit();
    this.log('INFO', 'Disconnected from Redis');
  }

  async exportRedisJobs(): Promise<Map<string, RedisJobData>> {
    this.log('INFO', 'Exporting jobs from Redis...');
    const jobs = new Map<string, RedisJobData>();
    
    // Bull queue stores jobs with keys like: bull:queue-name:job-id
    // We need to scan for all job keys
    const queuePrefix = 'bull:resume-processing:';
    
    // Get all job IDs from the queue
    const jobIds: string[] = [];
    
    // Scan for active jobs
    const activeKeys = await this.redisClient.smembers(`${queuePrefix}active`);
    jobIds.push(...activeKeys);
    
    // Scan for waiting jobs
    const waitingKeys = await this.redisClient.lrange(`${queuePrefix}wait`, 0, -1);
    jobIds.push(...waitingKeys);
    
    // Scan for delayed jobs
    const delayedKeys = await this.redisClient.zrange(`${queuePrefix}delayed`, 0, -1);
    jobIds.push(...delayedKeys);
    
    // Scan for completed jobs (last 100)
    const completedKeys = await this.redisClient.zrange(`${queuePrefix}completed`, -100, -1);
    jobIds.push(...completedKeys);
    
    // Scan for failed jobs
    const failedKeys = await this.redisClient.zrange(`${queuePrefix}failed`, 0, -1);
    jobIds.push(...failedKeys);
    
    this.log('INFO', `Found ${jobIds.length} job IDs`);
    
    // Fetch job data for each ID
    for (const jobId of jobIds) {
      try {
        const jobKey = `${queuePrefix}${jobId}`;
        const jobData = await this.redisClient.hgetall(jobKey);
        
        if (Object.keys(jobData).length > 0) {
          const job: RedisJobData = {
            id: jobId,
            name: jobData.name || 'resume-processing',
            data: jobData.data ? JSON.parse(jobData.data) : {},
            opts: jobData.opts ? JSON.parse(jobData.opts) : {},
            progress: parseInt(jobData.progress || '0', 10),
            delay: parseInt(jobData.delay || '0', 10),
            timestamp: parseInt(jobData.timestamp || '0', 10),
            attemptsMade: parseInt(jobData.attemptsMade || '0', 10),
            stacktrace: jobData.stacktrace ? JSON.parse(jobData.stacktrace) : [],
            returnvalue: jobData.returnvalue ? JSON.parse(jobData.returnvalue) : null,
            finishedOn: jobData.finishedOn ? parseInt(jobData.finishedOn, 10) : null,
            processedOn: jobData.processedOn ? parseInt(jobData.processedOn, 10) : null,
          };
          
          jobs.set(jobId, job);
          this.summary.totalRedisJobs++;
          
          // Categorize jobs
          if (job.finishedOn && !job.stacktrace.length) {
            this.summary.completedJobs++;
          } else if (job.stacktrace.length > 0) {
            this.summary.failedJobs++;
          } else {
            this.summary.activeJobs++;
          }
        }
      } catch (error) {
        this.log('ERROR', `Failed to export job ${jobId}: ${error.message}`);
        this.summary.errors.push(`Export job ${jobId}: ${error.message}`);
      }
    }
    
    this.log('INFO', `Exported ${jobs.size} jobs from Redis`);
    this.log('INFO', `  Active: ${this.summary.activeJobs}`);
    this.log('INFO', `  Completed: ${this.summary.completedJobs}`);
    this.log('INFO', `  Failed: ${this.summary.failedJobs}`);
    
    // Save to JSON for backup
    const exportFile = join(this.config.exportDir, 'redis-jobs-export.json');
    const jobsArray = Array.from(jobs.values());
    writeFileSync(exportFile, JSON.stringify(jobsArray, null, 2), 'utf-8');
    this.log('INFO', `Jobs exported to: ${exportFile}`);
    
    return jobs;
  }

  transformToDurableObjectFormat(redisJob: RedisJobData): DurableObjectJobData {
    // Transform Redis Bull job format to Durable Object format
    const sessionId = redisJob.data.sessionId || redisJob.id;
    
    let status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
    if (redisJob.finishedOn && !redisJob.stacktrace.length) {
      status = 'completed';
    } else if (redisJob.stacktrace.length > 0) {
      status = 'failed';
    } else if (redisJob.processedOn) {
      status = 'processing';
    }
    
    return {
      sessionId,
      fileKey: redisJob.data.fileKey || '',
      userId: redisJob.data.userId,
      status,
      progress: redisJob.progress,
      createdAt: redisJob.timestamp,
      updatedAt: Date.now(),
      error: redisJob.stacktrace.length > 0 ? redisJob.stacktrace.join('\n') : undefined,
      result: redisJob.returnvalue,
    };
  }

  async importToKV(jobId: string, jobData: DurableObjectJobData): Promise<void> {
    try {
      // Use Cloudflare KV API to store job data
      const kvKey = `job:${jobId}`;
      const kvValue = JSON.stringify(jobData);
      
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.cloudflareAccountId}/storage/kv/namespaces/${this.config.kvNamespaceId}/values/${kvKey}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.config.cloudflareApiToken}`,
            'Content-Type': 'text/plain',
          },
          body: kvValue,
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`KV API error: ${error}`);
      }
      
      this.summary.migratedToKV++;
      this.log('SUCCESS', `✓ Imported job ${jobId} to KV`);
    } catch (error) {
      this.log('ERROR', `Failed to import job ${jobId} to KV: ${error.message}`);
      this.summary.errors.push(`Import to KV ${jobId}: ${error.message}`);
      throw error;
    }
  }

  async recreateInDurableObject(jobId: string, jobData: DurableObjectJobData): Promise<void> {
    try {
      // Call Durable Object to recreate the job
      // This assumes the Worker has an endpoint to restore jobs
      const response = await fetch(
        `https://${this.config.workerName}.${this.config.cloudflareAccountId}.workers.dev/queue/restore`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.cloudflareApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId,
            jobData,
          }),
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Durable Object API error: ${error}`);
      }
      
      this.summary.migratedToDO++;
      this.log('SUCCESS', `✓ Recreated job ${jobId} in Durable Object`);
    } catch (error) {
      this.log('WARN', `Could not recreate job ${jobId} in Durable Object: ${error.message}`);
      // Don't throw - KV import is more important
    }
  }

  async verifyJob(jobId: string): Promise<boolean> {
    try {
      // Verify job exists in KV
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.cloudflareAccountId}/storage/kv/namespaces/${this.config.kvNamespaceId}/values/job:${jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.cloudflareApiToken}`,
          },
        }
      );
      
      if (response.ok) {
        this.summary.verifiedJobs++;
        return true;
      }
      
      return false;
    } catch (error) {
      this.log('ERROR', `Failed to verify job ${jobId}: ${error.message}`);
      return false;
    }
  }

  async migrate(): Promise<void> {
    try {
      await this.connect();
      
      // Create export directory
      if (!existsSync(this.config.exportDir)) {
        mkdirSync(this.config.exportDir, { recursive: true });
      }
      
      // Export jobs from Redis
      const redisJobs = await this.exportRedisJobs();
      
      if (redisJobs.size === 0) {
        this.log('INFO', 'No jobs to migrate');
        this.summary.success = true;
        return;
      }
      
      // Import to KV and Durable Objects
      this.log('INFO', 'Importing jobs to KV and Durable Objects...');
      
      for (const [jobId, redisJob] of redisJobs) {
        try {
          // Transform to Durable Object format
          const doJobData = this.transformToDurableObjectFormat(redisJob);
          
          // Import to KV (for caching)
          await this.importToKV(jobId, doJobData);
          
          // Recreate active jobs in Durable Objects
          if (doJobData.status === 'pending' || doJobData.status === 'processing') {
            await this.recreateInDurableObject(jobId, doJobData);
          }
          
          // Verify if enabled
          if (this.config.verifyJobs) {
            await this.verifyJob(jobId);
          }
        } catch (error) {
          this.log('ERROR', `Failed to migrate job ${jobId}: ${error.message}`);
          this.summary.errors.push(`Migrate job ${jobId}: ${error.message}`);
        }
      }
      
      this.summary.success = this.summary.errors.length === 0;
      this.summary.endTime = new Date().toISOString();
      
    } finally {
      await this.disconnect();
    }
  }

  printSummary(): void {
    this.log('INFO', '='.repeat(80));
    this.log('INFO', 'Migration Summary');
    this.log('INFO', '='.repeat(80));
    this.log('INFO', `Total Redis Jobs: ${this.summary.totalRedisJobs}`);
    this.log('INFO', `  Active: ${this.summary.activeJobs}`);
    this.log('INFO', `  Completed: ${this.summary.completedJobs}`);
    this.log('INFO', `  Failed: ${this.summary.failedJobs}`);
    this.log('INFO', `Migrated to KV: ${this.summary.migratedToKV}`);
    this.log('INFO', `Migrated to DO: ${this.summary.migratedToDO}`);
    this.log('INFO', `Verified: ${this.summary.verifiedJobs}`);
    this.log('INFO', `Errors: ${this.summary.errors.length}`);
    this.log('INFO', `Success: ${this.summary.success ? 'YES' : 'NO'}`);
    this.log('INFO', '='.repeat(80));
    
    if (this.summary.errors.length > 0) {
      this.log('WARN', 'Errors encountered:');
      this.summary.errors.forEach(error => {
        this.log('WARN', `  - ${error}`);
      });
    }
    
    // Save summary to file
    const summaryFile = join(this.config.exportDir, 'redis-migration-summary.json');
    writeFileSync(summaryFile, JSON.stringify(this.summary, null, 2), 'utf-8');
    this.log('INFO', `Summary saved to: ${summaryFile}`);
  }

  close(): void {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

// Main execution
async function main() {
  const config: MigrationConfig = {
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    redisPassword: process.env.REDIS_PASSWORD,
    redisDb: parseInt(process.env.REDIS_DB || '0', 10),
    
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    kvNamespaceId: process.env.KV_NAMESPACE_ID || '',
    workerName: process.env.WORKER_NAME || 'ai-resume-portfolio',
    
    exportDir: join(process.cwd(), 'migration-data'),
    logFile: join(process.cwd(), 'logs', 'redis-to-kv-migration.log'),
    verifyJobs: process.env.VERIFY_JOBS !== 'false',
  };
  
  // Validate configuration
  const requiredFields = [
    'cloudflareAccountId',
    'cloudflareApiToken',
    'kvNamespaceId',
  ];
  
  const missingFields = requiredFields.filter(field => !config[field]);
  if (missingFields.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingFields.forEach(field => console.error(`   - ${field}`));
    process.exit(1);
  }
  
  const migrator = new RedisToKVMigrator(config);
  
  try {
    await migrator.migrate();
    migrator.printSummary();
    
    if (!migrator['summary'].success) {
      console.error('\n⚠️  Migration completed with errors.');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    migrator.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { RedisToKVMigrator, MigrationConfig, MigrationSummary };
