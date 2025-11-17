#!/usr/bin/env node

/**
 * S3 to R2 Migration Script
 * 
 * This script migrates all files from AWS S3 to Cloudflare R2 with:
 * - Parallel file transfers with progress tracking
 * - Checksum verification (MD5/ETag comparison)
 * - Resume capability for interrupted migrations
 * - Comprehensive logging
 * - Rollback mechanism on failure
 * 
 * Requirements: 11.1, 11.4
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

// Configuration
interface MigrationConfig {
  // AWS S3 Configuration
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  s3BucketName: string;
  
  // Cloudflare R2 Configuration
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  
  // Migration Settings
  parallelTransfers: number;
  checkpointFile: string;
  logFile: string;
  verifyChecksums: boolean;
}

interface MigrationCheckpoint {
  lastProcessedKey: string;
  totalFiles: number;
  processedFiles: number;
  successfulTransfers: number;
  failedTransfers: number;
  transferredKeys: string[];
  failedKeys: { key: string; error: string }[];
  startTime: string;
  lastUpdateTime: string;
}

interface TransferResult {
  key: string;
  success: boolean;
  error?: string;
  sourceChecksum?: string;
  targetChecksum?: string;
  size?: number;
}

class S3ToR2Migrator {
  private s3Client: S3Client;
  private r2Client: S3Client;
  private config: MigrationConfig;
  private checkpoint: MigrationCheckpoint;
  private logStream: any;

  constructor(config: MigrationConfig) {
    this.config = config;
    
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });
    
    // Initialize R2 client (S3-compatible)
    this.r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    });
    
    // Load or initialize checkpoint
    this.checkpoint = this.loadCheckpoint();
    
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
    this.log('INFO', 'S3 to R2 Migration Started');
    this.log('INFO', `Source: s3://${this.config.s3BucketName}`);
    this.log('INFO', `Target: r2://${this.config.r2BucketName}`);
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

  private loadCheckpoint(): MigrationCheckpoint {
    if (existsSync(this.config.checkpointFile)) {
      try {
        const data = readFileSync(this.config.checkpointFile, 'utf-8');
        const checkpoint = JSON.parse(data);
        this.log('INFO', `Resuming migration from checkpoint: ${checkpoint.processedFiles}/${checkpoint.totalFiles} files processed`);
        return checkpoint;
      } catch (error) {
        this.log('WARN', `Failed to load checkpoint: ${error.message}`);
      }
    }
    
    return {
      lastProcessedKey: '',
      totalFiles: 0,
      processedFiles: 0,
      successfulTransfers: 0,
      failedTransfers: 0,
      transferredKeys: [],
      failedKeys: [],
      startTime: new Date().toISOString(),
      lastUpdateTime: new Date().toISOString(),
    };
  }

  private saveCheckpoint(): void {
    this.checkpoint.lastUpdateTime = new Date().toISOString();
    writeFileSync(
      this.config.checkpointFile,
      JSON.stringify(this.checkpoint, null, 2),
      'utf-8'
    );
  }

  async listAllS3Objects(): Promise<string[]> {
    this.log('INFO', 'Listing all objects in S3 bucket...');
    const allKeys: string[] = [];
    let continuationToken: string | undefined;
    
    do {
      const command = new ListObjectsV2Command({
        Bucket: this.config.s3BucketName,
        ContinuationToken: continuationToken,
      });
      
      const response = await this.s3Client.send(command);
      
      if (response.Contents) {
        const keys = response.Contents.map(obj => obj.Key!).filter(key => key);
        allKeys.push(...keys);
        this.log('INFO', `Found ${keys.length} objects (total: ${allKeys.length})`);
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    this.log('INFO', `Total objects found: ${allKeys.length}`);
    return allKeys;
  }

  async transferFile(key: string): Promise<TransferResult> {
    try {
      // Get object from S3
      const getCommand = new GetObjectCommand({
        Bucket: this.config.s3BucketName,
        Key: key,
      });
      
      const s3Response = await this.s3Client.send(getCommand);
      const bodyBytes = await s3Response.Body!.transformToByteArray();
      const buffer = Buffer.from(bodyBytes);
      
      // Calculate checksum if verification enabled
      let sourceChecksum: string | undefined;
      if (this.config.verifyChecksums) {
        sourceChecksum = createHash('md5').update(buffer).digest('hex');
      }
      
      // Upload to R2 using S3-compatible API
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const putCommand = new PutObjectCommand({
        Bucket: this.config.r2BucketName,
        Key: key,
        Body: buffer,
        ContentType: s3Response.ContentType,
        Metadata: s3Response.Metadata,
      });
      
      await this.r2Client.send(putCommand);
      
      // Verify checksum if enabled
      let targetChecksum: string | undefined;
      if (this.config.verifyChecksums && sourceChecksum) {
        const headCommand = new HeadObjectCommand({
          Bucket: this.config.r2BucketName,
          Key: key,
        });
        
        const r2Head = await this.r2Client.send(headCommand);
        targetChecksum = r2Head.ETag?.replace(/"/g, '');
        
        if (sourceChecksum !== targetChecksum) {
          throw new Error(`Checksum mismatch: source=${sourceChecksum}, target=${targetChecksum}`);
        }
      }
      
      return {
        key,
        success: true,
        sourceChecksum,
        targetChecksum,
        size: buffer.length,
      };
    } catch (error) {
      return {
        key,
        success: false,
        error: error.message,
      };
    }
  }

  async migrateWithProgress(): Promise<void> {
    // Get all objects to migrate
    const allKeys = await this.listAllS3Objects();
    this.checkpoint.totalFiles = allKeys.length;
    
    // Filter out already processed keys
    const keysToProcess = allKeys.filter(
      key => !this.checkpoint.transferredKeys.includes(key)
    );
    
    if (keysToProcess.length === 0) {
      this.log('INFO', 'All files already migrated!');
      return;
    }
    
    this.log('INFO', `Files to migrate: ${keysToProcess.length}`);
    this.log('INFO', `Using ${this.config.parallelTransfers} parallel transfers`);
    
    // Process files in batches
    const batchSize = this.config.parallelTransfers;
    for (let i = 0; i < keysToProcess.length; i += batchSize) {
      const batch = keysToProcess.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(keysToProcess.length / batchSize);
      
      this.log('INFO', `Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)`);
      
      // Transfer files in parallel
      const results = await Promise.all(
        batch.map(key => this.transferFile(key))
      );
      
      // Process results
      for (const result of results) {
        this.checkpoint.processedFiles++;
        
        if (result.success) {
          this.checkpoint.successfulTransfers++;
          this.checkpoint.transferredKeys.push(result.key);
          this.log('SUCCESS', `✓ ${result.key} (${result.size} bytes)`);
        } else {
          this.checkpoint.failedTransfers++;
          this.checkpoint.failedKeys.push({
            key: result.key,
            error: result.error!,
          });
          this.log('ERROR', `✗ ${result.key}: ${result.error}`);
        }
        
        this.checkpoint.lastProcessedKey = result.key;
      }
      
      // Save checkpoint after each batch
      this.saveCheckpoint();
      
      // Progress update
      const progress = ((this.checkpoint.processedFiles / this.checkpoint.totalFiles) * 100).toFixed(2);
      this.log('INFO', `Progress: ${this.checkpoint.processedFiles}/${this.checkpoint.totalFiles} (${progress}%)`);
    }
  }

  async rollback(): Promise<void> {
    this.log('WARN', 'Starting rollback - deleting all transferred files from R2...');
    
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    let deletedCount = 0;
    
    for (const key of this.checkpoint.transferredKeys) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: this.config.r2BucketName,
          Key: key,
        });
        
        await this.r2Client.send(deleteCommand);
        deletedCount++;
        
        if (deletedCount % 100 === 0) {
          this.log('INFO', `Rolled back ${deletedCount}/${this.checkpoint.transferredKeys.length} files`);
        }
      } catch (error) {
        this.log('ERROR', `Failed to delete ${key}: ${error.message}`);
      }
    }
    
    this.log('INFO', `Rollback complete: ${deletedCount} files deleted from R2`);
  }

  printSummary(): void {
    const duration = Date.now() - new Date(this.checkpoint.startTime).getTime();
    const durationMinutes = (duration / 1000 / 60).toFixed(2);
    
    this.log('INFO', '='.repeat(80));
    this.log('INFO', 'Migration Summary');
    this.log('INFO', '='.repeat(80));
    this.log('INFO', `Total Files: ${this.checkpoint.totalFiles}`);
    this.log('INFO', `Successful: ${this.checkpoint.successfulTransfers}`);
    this.log('INFO', `Failed: ${this.checkpoint.failedTransfers}`);
    this.log('INFO', `Duration: ${durationMinutes} minutes`);
    this.log('INFO', '='.repeat(80));
    
    if (this.checkpoint.failedKeys.length > 0) {
      this.log('WARN', 'Failed transfers:');
      this.checkpoint.failedKeys.forEach(({ key, error }) => {
        this.log('WARN', `  - ${key}: ${error}`);
      });
    }
  }

  async close(): Promise<void> {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

// Main execution
async function main() {
  // Load configuration from environment variables
  const config: MigrationConfig = {
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    s3BucketName: process.env.S3_BUCKET_NAME || '',
    
    r2AccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    r2BucketName: process.env.R2_BUCKET_NAME || 'ai-resume-storage',
    
    parallelTransfers: parseInt(process.env.PARALLEL_TRANSFERS || '5', 10),
    checkpointFile: join(process.cwd(), 'logs', 's3-to-r2-checkpoint.json'),
    logFile: join(process.cwd(), 'logs', 's3-to-r2-migration.log'),
    verifyChecksums: process.env.VERIFY_CHECKSUMS !== 'false',
  };
  
  // Validate configuration
  const requiredFields = [
    'awsAccessKeyId',
    'awsSecretAccessKey',
    's3BucketName',
    'r2AccountId',
    'r2AccessKeyId',
    'r2SecretAccessKey',
  ];
  
  const missingFields = requiredFields.filter(field => !config[field]);
  if (missingFields.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingFields.forEach(field => console.error(`   - ${field}`));
    console.error('\nPlease set these variables and try again.');
    process.exit(1);
  }
  
  const migrator = new S3ToR2Migrator(config);
  
  try {
    await migrator.migrateWithProgress();
    migrator.printSummary();
    
    // Check if migration was successful
    const checkpoint = migrator['checkpoint'];
    if (checkpoint.failedTransfers > 0) {
      console.error('\n⚠️  Migration completed with errors. Check the log file for details.');
      
      const shouldRollback = process.env.ROLLBACK_ON_ERROR === 'true';
      if (shouldRollback) {
        console.log('\n🔄 Rolling back due to ROLLBACK_ON_ERROR=true...');
        await migrator.rollback();
      }
      
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    
    const shouldRollback = process.env.ROLLBACK_ON_ERROR === 'true';
    if (shouldRollback) {
      console.log('\n🔄 Rolling back...');
      await migrator.rollback();
    }
    
    process.exit(1);
  } finally {
    await migrator.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { S3ToR2Migrator, MigrationConfig, MigrationCheckpoint, TransferResult };
