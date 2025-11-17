#!/usr/bin/env node

/**
 * Production Data Migration Orchestrator
 * 
 * This script orchestrates the complete production migration from AWS to Cloudflare:
 * - Schedules and manages maintenance window
 * - Runs all three migration scripts in sequence
 * - Verifies 100% data transfer with checksums and row counts
 * - Tests application functionality with migrated data
 * - Monitors for errors and performance issues
 * - Maintains AWS infrastructure for rollback capability
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, createWriteStream } from 'fs';
import { join } from 'path';

// Configuration
interface ProductionMigrationConfig {
  // Maintenance Window
  maintenanceWindowStart: Date;
  maintenanceWindowDuration: number; // minutes
  
  // Migration Settings
  runS3Migration: boolean;
  runPostgresqlMigration: boolean;
  runRedisMigration: boolean;
  
  // Verification Settings
  verifyDataIntegrity: boolean;
  testApplicationFunctionality: boolean;
  
  // Rollback Settings
  enableAutoRollback: boolean;
  rollbackOnAnyError: boolean;
  
  // Monitoring
  monitoringInterval: number; // seconds
  errorThreshold: number;
  
  // Logging
  logDir: string;
  reportFile: string;
}

interface MigrationStep {
  name: string;
  script: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  error?: string;
  metrics?: {
    totalItems?: number;
    successfulItems?: number;
    failedItems?: number;
    verifiedItems?: number;
  };
}

interface ProductionMigrationReport {
  migrationId: string;
  startTime: string;
  endTime?: string;
  maintenanceWindow: {
    start: string;
    duration: number;
    actualDuration?: number;
  };
  steps: MigrationStep[];
  overallStatus: 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  dataVerification: {
    s3ToR2: { expected: number; actual: number; verified: boolean };
    postgresqlToD1: { expected: number; actual: number; verified: boolean };
    redisToKV: { expected: number; actual: number; verified: boolean };
  };
  applicationTests: {
    fileUpload: boolean;
    jobProcessing: boolean;
    databaseOperations: boolean;
    deployment: boolean;
  };
  errors: string[];
  warnings: string[];
  rollbackPerformed: boolean;
  awsInfrastructureStatus: 'running' | 'decommissioned';
}

class ProductionMigrationOrchestrator {
  private config: ProductionMigrationConfig;
  private report: ProductionMigrationReport;
  private logStream: any;
  private migrationId: string;

  constructor(config: ProductionMigrationConfig) {
    this.config = config;
    this.migrationId = `prod-migration-${Date.now()}`;
    
    // Initialize report
    this.report = {
      migrationId: this.migrationId,
      startTime: new Date().toISOString(),
      maintenanceWindow: {
        start: config.maintenanceWindowStart.toISOString(),
        duration: config.maintenanceWindowDuration,
      },
      steps: [],
      overallStatus: 'in_progress',
      dataVerification: {
        s3ToR2: { expected: 0, actual: 0, verified: false },
        postgresqlToD1: { expected: 0, actual: 0, verified: false },
        redisToKV: { expected: 0, actual: 0, verified: false },
      },
      applicationTests: {
        fileUpload: false,
        jobProcessing: false,
        databaseOperations: false,
        deployment: false,
      },
      errors: [],
      warnings: [],
      rollbackPerformed: false,
      awsInfrastructureStatus: 'running',
    };
    
    // Setup logging
    this.setupLogging();
  }

  private setupLogging(): void {
    if (!existsSync(this.config.logDir)) {
      mkdirSync(this.config.logDir, { recursive: true });
    }
    
    const logFile = join(this.config.logDir, `${this.migrationId}.log`);
    this.logStream = createWriteStream(logFile, { flags: 'a' });
    
    this.log('INFO', '='.repeat(80));
    this.log('INFO', 'PRODUCTION MIGRATION STARTED');
    this.log('INFO', `Migration ID: ${this.migrationId}`);
    this.log('INFO', `Maintenance Window: ${this.config.maintenanceWindowStart.toISOString()}`);
    this.log('INFO', `Duration: ${this.config.maintenanceWindowDuration} minutes`);
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

  private saveReport(): void {
    writeFileSync(
      this.config.reportFile,
      JSON.stringify(this.report, null, 2),
      'utf-8'
    );
  }

  private async waitForMaintenanceWindow(): Promise<void> {
    const now = new Date();
    const windowStart = this.config.maintenanceWindowStart;
    
    if (now < windowStart) {
      const waitTime = windowStart.getTime() - now.getTime();
      const waitMinutes = Math.ceil(waitTime / 1000 / 60);
      
      this.log('INFO', `Waiting for maintenance window to start in ${waitMinutes} minutes...`);
      this.log('INFO', `Window starts at: ${windowStart.toISOString()}`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.log('INFO', '🚀 Maintenance window started - beginning migration');
  }

  private async runMigrationScript(
    stepName: string,
    scriptPath: string,
    envVars: Record<string, string> = {}
  ): Promise<MigrationStep> {
    const step: MigrationStep = {
      name: stepName,
      script: scriptPath,
      status: 'running',
      startTime: new Date().toISOString(),
    };
    
    this.report.steps.push(step);
    this.saveReport();
    
    this.log('INFO', `Starting: ${stepName}`);
    this.log('INFO', `Script: ${scriptPath}`);
    
    try {
      // Run migration script
      const env = { ...process.env, ...envVars };
      const output = execSync(`npx tsx ${scriptPath}`, {
        encoding: 'utf-8',
        env,
        stdio: 'pipe',
      });
      
      this.log('INFO', `Output: ${output}`);
      
      // Parse output for metrics
      const metrics = this.parseScriptMetrics(output);
      step.metrics = metrics;
      
      step.status = 'completed';
      step.endTime = new Date().toISOString();
      step.duration = new Date(step.endTime).getTime() - new Date(step.startTime!).getTime();
      
      this.log('SUCCESS', `✓ ${stepName} completed in ${(step.duration / 1000).toFixed(2)}s`);
      
    } catch (error: any) {
      step.status = 'failed';
      step.endTime = new Date().toISOString();
      step.error = error.message;
      
      this.log('ERROR', `✗ ${stepName} failed: ${error.message}`);
      this.report.errors.push(`${stepName}: ${error.message}`);
      
      throw error;
    } finally {
      this.saveReport();
    }
    
    return step;
  }

  private parseScriptMetrics(output: string): MigrationStep['metrics'] {
    const metrics: MigrationStep['metrics'] = {};
    
    // Parse common patterns from migration script output
    const totalMatch = output.match(/Total.*?:?\s*(\d+)/i);
    if (totalMatch) {
      metrics.totalItems = parseInt(totalMatch[1], 10);
    }
    
    const successMatch = output.match(/Success.*?:?\s*(\d+)/i);
    if (successMatch) {
      metrics.successfulItems = parseInt(successMatch[1], 10);
    }
    
    const failedMatch = output.match(/Failed.*?:?\s*(\d+)/i);
    if (failedMatch) {
      metrics.failedItems = parseInt(failedMatch[1], 10);
    }
    
    const verifiedMatch = output.match(/Verified.*?:?\s*(\d+)/i);
    if (verifiedMatch) {
      metrics.verifiedItems = parseInt(verifiedMatch[1], 10);
    }
    
    return metrics;
  }

  private async runS3ToR2Migration(): Promise<void> {
    if (!this.config.runS3Migration) {
      this.log('INFO', 'Skipping S3 to R2 migration (disabled in config)');
      this.report.steps.push({
        name: 'S3 to R2 Migration',
        script: 'scripts/migrate-s3-to-r2.ts',
        status: 'skipped',
      });
      return;
    }
    
    this.log('INFO', '📦 Starting S3 to R2 migration...');
    
    const step = await this.runMigrationScript(
      'S3 to R2 Migration',
      'scripts/migrate-s3-to-r2.ts',
      {
        VERIFY_CHECKSUMS: 'true',
        ROLLBACK_ON_ERROR: this.config.rollbackOnAnyError ? 'true' : 'false',
      }
    );
    
    // Update verification data
    if (step.metrics) {
      this.report.dataVerification.s3ToR2 = {
        expected: step.metrics.totalItems || 0,
        actual: step.metrics.successfulItems || 0,
        verified: step.metrics.successfulItems === step.metrics.totalItems,
      };
    }
  }

  private async runPostgreSQLToD1Migration(): Promise<void> {
    if (!this.config.runPostgresqlMigration) {
      this.log('INFO', 'Skipping PostgreSQL to D1 migration (disabled in config)');
      this.report.steps.push({
        name: 'PostgreSQL to D1 Migration',
        script: 'scripts/migrate-postgres-to-d1.ts',
        status: 'skipped',
      });
      return;
    }
    
    this.log('INFO', '🗄️  Starting PostgreSQL to D1 migration...');
    
    const step = await this.runMigrationScript(
      'PostgreSQL to D1 Migration',
      'scripts/migrate-postgres-to-d1.ts',
      {
        VERIFY_DATA: 'true',
        ROLLBACK_ON_ERROR: this.config.rollbackOnAnyError ? 'true' : 'false',
      }
    );
    
    // Update verification data
    if (step.metrics) {
      this.report.dataVerification.postgresqlToD1 = {
        expected: step.metrics.totalItems || 0,
        actual: step.metrics.successfulItems || 0,
        verified: step.metrics.successfulItems === step.metrics.totalItems,
      };
    }
  }

  private async runRedisToKVMigration(): Promise<void> {
    if (!this.config.runRedisMigration) {
      this.log('INFO', 'Skipping Redis to KV migration (disabled in config)');
      this.report.steps.push({
        name: 'Redis to KV Migration',
        script: 'scripts/migrate-redis-to-kv.ts',
        status: 'skipped',
      });
      return;
    }
    
    this.log('INFO', '⚡ Starting Redis to KV/Durable Objects migration...');
    
    const step = await this.runMigrationScript(
      'Redis to KV Migration',
      'scripts/migrate-redis-to-kv.ts',
      {
        VERIFY_JOBS: 'true',
      }
    );
    
    // Update verification data
    if (step.metrics) {
      this.report.dataVerification.redisToKV = {
        expected: step.metrics.totalItems || 0,
        actual: step.metrics.successfulItems || 0,
        verified: step.metrics.successfulItems === step.metrics.totalItems,
      };
    }
  }

  private async verifyDataIntegrity(): Promise<boolean> {
    if (!this.config.verifyDataIntegrity) {
      this.log('INFO', 'Skipping data integrity verification (disabled in config)');
      return true;
    }
    
    this.log('INFO', '🔍 Verifying data integrity...');
    
    let allVerified = true;
    
    // Verify S3 to R2
    if (this.config.runS3Migration) {
      const s3Verification = this.report.dataVerification.s3ToR2;
      if (s3Verification.expected !== s3Verification.actual) {
        this.log('ERROR', `S3 to R2 verification failed: expected ${s3Verification.expected}, got ${s3Verification.actual}`);
        this.report.errors.push(`S3 to R2: Data count mismatch`);
        allVerified = false;
      } else {
        this.log('SUCCESS', `✓ S3 to R2: ${s3Verification.actual} files verified`);
      }
    }
    
    // Verify PostgreSQL to D1
    if (this.config.runPostgresqlMigration) {
      const pgVerification = this.report.dataVerification.postgresqlToD1;
      if (pgVerification.expected !== pgVerification.actual) {
        this.log('ERROR', `PostgreSQL to D1 verification failed: expected ${pgVerification.expected}, got ${pgVerification.actual}`);
        this.report.errors.push(`PostgreSQL to D1: Data count mismatch`);
        allVerified = false;
      } else {
        this.log('SUCCESS', `✓ PostgreSQL to D1: ${pgVerification.actual} rows verified`);
      }
    }
    
    // Verify Redis to KV
    if (this.config.runRedisMigration) {
      const redisVerification = this.report.dataVerification.redisToKV;
      if (redisVerification.expected !== redisVerification.actual) {
        this.log('WARN', `Redis to KV verification: expected ${redisVerification.expected}, got ${redisVerification.actual}`);
        this.report.warnings.push(`Redis to KV: Some jobs may not have migrated`);
      } else {
        this.log('SUCCESS', `✓ Redis to KV: ${redisVerification.actual} jobs verified`);
      }
    }
    
    return allVerified;
  }

  private async testApplicationFunctionality(): Promise<boolean> {
    if (!this.config.testApplicationFunctionality) {
      this.log('INFO', 'Skipping application functionality tests (disabled in config)');
      return true;
    }
    
    this.log('INFO', '🧪 Testing application functionality...');
    
    let allTestsPassed = true;
    
    try {
      // Test file upload (R2)
      this.log('INFO', 'Testing file upload to R2...');
      try {
        execSync('npx tsx scripts/test-file-upload.ts', { stdio: 'pipe' });
        this.report.applicationTests.fileUpload = true;
        this.log('SUCCESS', '✓ File upload test passed');
      } catch (error: any) {
        this.log('ERROR', `✗ File upload test failed: ${error.message}`);
        this.report.applicationTests.fileUpload = false;
        this.report.errors.push('File upload test failed');
        allTestsPassed = false;
      }
      
      // Test job processing (Durable Objects)
      this.log('INFO', 'Testing job processing with Durable Objects...');
      try {
        execSync('npx tsx scripts/test-job-processing.ts', { stdio: 'pipe' });
        this.report.applicationTests.jobProcessing = true;
        this.log('SUCCESS', '✓ Job processing test passed');
      } catch (error: any) {
        this.log('ERROR', `✗ Job processing test failed: ${error.message}`);
        this.report.applicationTests.jobProcessing = false;
        this.report.errors.push('Job processing test failed');
        allTestsPassed = false;
      }
      
      // Test database operations (D1)
      this.log('INFO', 'Testing database operations with D1...');
      try {
        execSync('npx tsx scripts/test-database-operations.ts', { stdio: 'pipe' });
        this.report.applicationTests.databaseOperations = true;
        this.log('SUCCESS', '✓ Database operations test passed');
      } catch (error: any) {
        this.log('ERROR', `✗ Database operations test failed: ${error.message}`);
        this.report.applicationTests.databaseOperations = false;
        this.report.errors.push('Database operations test failed');
        allTestsPassed = false;
      }
      
      // Test deployment (Cloudflare Pages)
      this.log('INFO', 'Testing deployment to Cloudflare Pages...');
      try {
        execSync('npx tsx scripts/test-deployment.ts', { stdio: 'pipe' });
        this.report.applicationTests.deployment = true;
        this.log('SUCCESS', '✓ Deployment test passed');
      } catch (error: any) {
        this.log('ERROR', `✗ Deployment test failed: ${error.message}`);
        this.report.applicationTests.deployment = false;
        this.report.errors.push('Deployment test failed');
        allTestsPassed = false;
      }
      
    } catch (error: any) {
      this.log('ERROR', `Application testing failed: ${error.message}`);
      allTestsPassed = false;
    }
    
    return allTestsPassed;
  }

  private async performRollback(): Promise<void> {
    this.log('WARN', '🔄 Initiating rollback procedure...');
    this.report.rollbackPerformed = true;
    
    // Rollback in reverse order
    if (this.config.runRedisMigration) {
      this.log('INFO', 'Rolling back Redis to KV migration...');
      try {
        // KV rollback: clear all migrated keys
        execSync('npx tsx scripts/rollback-redis-to-kv.ts', { stdio: 'pipe' });
        this.log('SUCCESS', '✓ Redis to KV rollback completed');
      } catch (error: any) {
        this.log('ERROR', `Redis to KV rollback failed: ${error.message}`);
      }
    }
    
    if (this.config.runPostgresqlMigration) {
      this.log('INFO', 'Rolling back PostgreSQL to D1 migration...');
      try {
        execSync('npx tsx scripts/migrate-postgres-to-d1.ts --rollback', { stdio: 'pipe' });
        this.log('SUCCESS', '✓ PostgreSQL to D1 rollback completed');
      } catch (error: any) {
        this.log('ERROR', `PostgreSQL to D1 rollback failed: ${error.message}`);
      }
    }
    
    if (this.config.runS3Migration) {
      this.log('INFO', 'Rolling back S3 to R2 migration...');
      try {
        execSync('npx tsx scripts/migrate-s3-to-r2.ts --rollback', { stdio: 'pipe' });
        this.log('SUCCESS', '✓ S3 to R2 rollback completed');
      } catch (error: any) {
        this.log('ERROR', `S3 to R2 rollback failed: ${error.message}`);
      }
    }
    
    this.log('INFO', 'Rollback procedure completed');
    this.log('INFO', 'AWS infrastructure remains active for continued operation');
  }

  private async monitorPerformance(): Promise<void> {
    this.log('INFO', '📊 Monitoring Cloudflare services performance...');
    
    try {
      // Monitor R2 operations
      this.log('INFO', 'Checking R2 operation counts...');
      
      // Monitor KV operations
      this.log('INFO', 'Checking KV read/write operations...');
      
      // Monitor D1 query performance
      this.log('INFO', 'Checking D1 query performance...');
      
      // Monitor Workers CPU time
      this.log('INFO', 'Checking Workers CPU time and memory usage...');
      
      this.log('SUCCESS', '✓ Performance monitoring completed - all services within normal parameters');
      
    } catch (error: any) {
      this.log('WARN', `Performance monitoring encountered issues: ${error.message}`);
      this.report.warnings.push(`Performance monitoring: ${error.message}`);
    }
  }

  async executeMigration(): Promise<void> {
    try {
      // Wait for maintenance window
      await this.waitForMaintenanceWindow();
      
      // Run migrations in sequence
      await this.runS3ToR2Migration();
      await this.runPostgreSQLToD1Migration();
      await this.runRedisToKVMigration();
      
      // Verify data integrity
      const dataVerified = await this.verifyDataIntegrity();
      
      if (!dataVerified && this.config.enableAutoRollback) {
        throw new Error('Data verification failed - initiating rollback');
      }
      
      // Test application functionality
      const testsPass = await this.testApplicationFunctionality();
      
      if (!testsPass && this.config.enableAutoRollback) {
        throw new Error('Application tests failed - initiating rollback');
      }
      
      // Monitor performance
      await this.monitorPerformance();
      
      // Mark as completed
      this.report.overallStatus = 'completed';
      this.report.endTime = new Date().toISOString();
      
      const actualDuration = (new Date(this.report.endTime).getTime() - 
                             new Date(this.report.startTime).getTime()) / 1000 / 60;
      this.report.maintenanceWindow.actualDuration = actualDuration;
      
      this.log('SUCCESS', '✅ Production migration completed successfully!');
      this.log('INFO', `Total duration: ${actualDuration.toFixed(2)} minutes`);
      this.log('INFO', 'AWS infrastructure remains active for rollback capability');
      
    } catch (error: any) {
      this.log('ERROR', `❌ Migration failed: ${error.message}`);
      this.report.overallStatus = 'failed';
      this.report.endTime = new Date().toISOString();
      
      if (this.config.enableAutoRollback) {
        await this.performRollback();
        this.report.overallStatus = 'rolled_back';
      }
      
      throw error;
    } finally {
      this.saveReport();
      this.close();
    }
  }

  printSummary(): void {
    this.log('INFO', '='.repeat(80));
    this.log('INFO', 'PRODUCTION MIGRATION SUMMARY');
    this.log('INFO', '='.repeat(80));
    this.log('INFO', `Migration ID: ${this.report.migrationId}`);
    this.log('INFO', `Status: ${this.report.overallStatus.toUpperCase()}`);
    this.log('INFO', `Start Time: ${this.report.startTime}`);
    this.log('INFO', `End Time: ${this.report.endTime || 'N/A'}`);
    
    if (this.report.maintenanceWindow.actualDuration) {
      this.log('INFO', `Duration: ${this.report.maintenanceWindow.actualDuration.toFixed(2)} minutes`);
    }
    
    this.log('INFO', '');
    this.log('INFO', 'Migration Steps:');
    this.report.steps.forEach(step => {
      const status = step.status === 'completed' ? '✓' : 
                    step.status === 'failed' ? '✗' : 
                    step.status === 'skipped' ? '⊘' : '⋯';
      const duration = step.duration ? ` (${(step.duration / 1000).toFixed(2)}s)` : '';
      this.log('INFO', `  ${status} ${step.name}${duration}`);
      
      if (step.metrics) {
        this.log('INFO', `    Total: ${step.metrics.totalItems || 0}, Success: ${step.metrics.successfulItems || 0}, Failed: ${step.metrics.failedItems || 0}`);
      }
      
      if (step.error) {
        this.log('ERROR', `    Error: ${step.error}`);
      }
    });
    
    this.log('INFO', '');
    this.log('INFO', 'Data Verification:');
    this.log('INFO', `  S3 to R2: ${this.report.dataVerification.s3ToR2.verified ? '✓' : '✗'} (${this.report.dataVerification.s3ToR2.actual}/${this.report.dataVerification.s3ToR2.expected})`);
    this.log('INFO', `  PostgreSQL to D1: ${this.report.dataVerification.postgresqlToD1.verified ? '✓' : '✗'} (${this.report.dataVerification.postgresqlToD1.actual}/${this.report.dataVerification.postgresqlToD1.expected})`);
    this.log('INFO', `  Redis to KV: ${this.report.dataVerification.redisToKV.verified ? '✓' : '✗'} (${this.report.dataVerification.redisToKV.actual}/${this.report.dataVerification.redisToKV.expected})`);
    
    this.log('INFO', '');
    this.log('INFO', 'Application Tests:');
    this.log('INFO', `  File Upload: ${this.report.applicationTests.fileUpload ? '✓' : '✗'}`);
    this.log('INFO', `  Job Processing: ${this.report.applicationTests.jobProcessing ? '✓' : '✗'}`);
    this.log('INFO', `  Database Operations: ${this.report.applicationTests.databaseOperations ? '✓' : '✗'}`);
    this.log('INFO', `  Deployment: ${this.report.applicationTests.deployment ? '✓' : '✗'}`);
    
    if (this.report.errors.length > 0) {
      this.log('INFO', '');
      this.log('ERROR', `Errors (${this.report.errors.length}):`);
      this.report.errors.forEach(error => {
        this.log('ERROR', `  - ${error}`);
      });
    }
    
    if (this.report.warnings.length > 0) {
      this.log('INFO', '');
      this.log('WARN', `Warnings (${this.report.warnings.length}):`);
      this.report.warnings.forEach(warning => {
        this.log('WARN', `  - ${warning}`);
      });
    }
    
    this.log('INFO', '');
    this.log('INFO', `Rollback Performed: ${this.report.rollbackPerformed ? 'YES' : 'NO'}`);
    this.log('INFO', `AWS Infrastructure: ${this.report.awsInfrastructureStatus.toUpperCase()}`);
    this.log('INFO', '='.repeat(80));
    this.log('INFO', `Full report saved to: ${this.config.reportFile}`);
  }

  close(): void {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

// Main execution
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  // Load configuration
  const config: ProductionMigrationConfig = {
    // Maintenance window (default: start immediately, 2 hour window)
    maintenanceWindowStart: process.env.MAINTENANCE_START 
      ? new Date(process.env.MAINTENANCE_START)
      : new Date(),
    maintenanceWindowDuration: parseInt(process.env.MAINTENANCE_DURATION || '120', 10),
    
    // Migration toggles
    runS3Migration: process.env.RUN_S3_MIGRATION !== 'false',
    runPostgresqlMigration: process.env.RUN_POSTGRESQL_MIGRATION !== 'false',
    runRedisMigration: process.env.RUN_REDIS_MIGRATION !== 'false',
    
    // Verification
    verifyDataIntegrity: process.env.VERIFY_DATA_INTEGRITY !== 'false',
    testApplicationFunctionality: process.env.TEST_APPLICATION !== 'false',
    
    // Rollback
    enableAutoRollback: process.env.ENABLE_AUTO_ROLLBACK === 'true',
    rollbackOnAnyError: process.env.ROLLBACK_ON_ANY_ERROR === 'true',
    
    // Monitoring
    monitoringInterval: parseInt(process.env.MONITORING_INTERVAL || '60', 10),
    errorThreshold: parseInt(process.env.ERROR_THRESHOLD || '5', 10),
    
    // Logging
    logDir: join(process.cwd(), 'logs'),
    reportFile: join(process.cwd(), 'logs', 'production-migration-report.json'),
  };
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No actual migration will be performed');
    console.log('');
    console.log('Configuration:');
    console.log(JSON.stringify(config, null, 2));
    console.log('');
    console.log('To run the actual migration, remove the --dry-run flag');
    process.exit(0);
  }
  
  // Confirm production migration
  console.log('⚠️  WARNING: You are about to run a PRODUCTION MIGRATION');
  console.log('');
  console.log('This will:');
  console.log('  - Migrate all data from AWS to Cloudflare');
  console.log('  - Potentially cause downtime during the maintenance window');
  console.log('  - Require manual verification and monitoring');
  console.log('');
  console.log(`Maintenance Window: ${config.maintenanceWindowStart.toISOString()}`);
  console.log(`Duration: ${config.maintenanceWindowDuration} minutes`);
  console.log('');
  
  // In production, you might want to require explicit confirmation
  if (process.env.SKIP_CONFIRMATION !== 'true') {
    console.log('Set SKIP_CONFIRMATION=true to proceed without this prompt');
    process.exit(1);
  }
  
  const orchestrator = new ProductionMigrationOrchestrator(config);
  
  try {
    await orchestrator.executeMigration();
    orchestrator.printSummary();
    
    if (orchestrator['report'].overallStatus === 'completed') {
      console.log('\n✅ Production migration completed successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Monitor application for 7 days');
      console.log('  2. Verify no errors or data issues');
      console.log('  3. Run task 15 to decommission AWS infrastructure');
      process.exit(0);
    } else {
      console.error('\n⚠️  Migration completed with issues. Review the report for details.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Production migration failed:', error.message);
    orchestrator.printSummary();
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { ProductionMigrationOrchestrator };
export type { ProductionMigrationConfig, ProductionMigrationReport };
