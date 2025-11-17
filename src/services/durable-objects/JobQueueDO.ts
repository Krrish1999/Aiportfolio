/**
 * JobQueueDO - Durable Object for managing resume processing jobs
 * 
 * This Durable Object replaces Redis/Bull queue with Cloudflare's stateful
 * serverless compute for job coordination and processing.
 */

import { DurableObject } from 'cloudflare:workers';
import { CloudflareWorkersEnv } from '@/config/cloudflare-env';
import { DatabaseService } from '@/services/database';
import { CloudflareErrorHandler } from '@/utils/errors';

// Job data interfaces
export interface ResumeProcessingJobData {
  sessionId: string;
  userId?: string;
  fileKey: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
}

export interface JobState {
  sessionId: string;
  userId?: string;
  fileKey: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: any;
  retryCount: number;
  maxRetries: number;
  logs: string[];
}

export class JobQueueDO extends DurableObject<CloudflareWorkersEnv> {
  private jobs: Map<string, JobState> = new Map();
  private processingJobId: string | null = null;
  private dbService: DatabaseService;

  constructor(ctx: DurableObjectState, env: CloudflareWorkersEnv) {
    super(ctx, env);
    this.dbService = new DatabaseService(env);
    this.initializeFromStorage();
  }

  /**
   * Fetch handler for job operations
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/add':
          return await this.handleAddJob(request);
        case '/status':
          return await this.handleGetStatus(request);
        case '/cancel':
          return await this.handleCancelJob(request);
        case '/process':
          return await this.handleProcessNext(request);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error: any) {
      console.error('JobQueueDO error:', error);
      return Response.json(
        { error: error.message || 'Internal server error' },
        { status: 500 }
      );
    }
  }

  /**
   * Handle add job request
   */
  private async handleAddJob(request: Request): Promise<Response> {
    const jobData: ResumeProcessingJobData = await request.json();
    const jobId = jobData.sessionId;

    // Create job state
    const job: JobState = {
      ...jobData,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      logs: [],
    };

    // Store in memory and persist to storage
    this.jobs.set(jobId, job);
    await this.ctx.storage.put(`job:${jobId}`, job);

    // Log job creation
    this.addLog(jobId, `Job created for file: ${jobData.originalFileName}`);

    // Trigger processing asynchronously
    this.ctx.waitUntil(this.processJob(jobId));

    return Response.json({
      success: true,
      jobId,
      status: job.status,
    });
  }

  /**
   * Handle get status request
   */
  private async handleGetStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return Response.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const job = this.jobs.get(jobId) || await this.ctx.storage.get<JobState>(`job:${jobId}`);

    if (!job) {
      return Response.json(
        { error: 'Job not found', status: 'not_found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      status: job.status,
      progress: job.progress,
      error: job.error,
      result: job.result,
      logs: job.logs,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  }

  /**
   * Handle cancel job request
   */
  private async handleCancelJob(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return Response.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const job = this.jobs.get(jobId) || await this.ctx.storage.get<JobState>(`job:${jobId}`);

    if (!job) {
      return Response.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if job can be cancelled
    if (job.status === 'completed') {
      return Response.json(
        { error: 'Cannot cancel completed job' },
        { status: 400 }
      );
    }

    // Update job status
    job.status = 'cancelled';
    job.completedAt = Date.now();
    this.addLog(jobId, 'Job cancelled by user');

    // Persist changes
    this.jobs.set(jobId, job);
    await this.ctx.storage.put(`job:${jobId}`, job);

    // Clear processing flag if this was the active job
    if (this.processingJobId === jobId) {
      this.processingJobId = null;
    }

    return Response.json({
      success: true,
      jobId,
      status: job.status,
      message: 'Job cancelled successfully',
    });
  }

  /**
   * Handle process next job request
   */
  private async handleProcessNext(request: Request): Promise<Response> {
    // Find next pending job
    const pendingJob = Array.from(this.jobs.values()).find(
      job => job.status === 'pending'
    );

    if (!pendingJob) {
      return Response.json({
        success: true,
        message: 'No pending jobs',
      });
    }

    // Trigger processing
    this.ctx.waitUntil(this.processJob(pendingJob.sessionId));

    return Response.json({
      success: true,
      jobId: pendingJob.sessionId,
      message: 'Processing started',
    });
  }

  /**
   * Process a job with progress tracking and error handling
   */
  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return;
    }

    // Check if already processing or completed
    if (job.status !== 'pending' && job.status !== 'failed') {
      return;
    }

    // Check if another job is currently processing
    if (this.processingJobId && this.processingJobId !== jobId) {
      console.log(`Job ${jobId} waiting for ${this.processingJobId} to complete`);
      return;
    }

    try {
      // Mark as processing
      this.processingJobId = jobId;
      job.status = 'processing';
      job.startedAt = Date.now();
      job.progress = 10;
      this.addLog(jobId, 'Starting resume processing...');
      await this.persistJob(jobId, job);

      // Step 1: Download file from R2
      job.progress = 20;
      this.addLog(jobId, 'Downloading file from storage...');
      await this.persistJob(jobId, job);

      const fileBuffer = await this.downloadFile(job.fileKey);
      
      job.progress = 40;
      this.addLog(jobId, 'File downloaded successfully');
      await this.persistJob(jobId, job);

      // Step 2: Extract text from resume
      job.progress = 50;
      this.addLog(jobId, 'Extracting text from resume...');
      await this.persistJob(jobId, job);

      // TODO: Implement actual resume parsing
      // For now, simulate processing with mock data
      await this.simulateProcessing(1000);

      job.progress = 70;
      this.addLog(jobId, 'Parsing resume content...');
      await this.persistJob(jobId, job);

      await this.simulateProcessing(1500);

      job.progress = 90;
      this.addLog(jobId, 'Validating extracted data...');
      await this.persistJob(jobId, job);

      await this.simulateProcessing(500);

      // Step 3: Complete processing
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = Date.now();
      job.result = {
        success: true,
        sessionId: jobId,
        parsedData: {
          profile: {
            name: 'Mock User',
            title: 'Software Developer',
            email: 'mock@example.com',
          },
          summary: 'Mock summary extracted from resume',
          skills: [],
          experience: [],
          projects: [],
          education: [],
        },
      };
      this.addLog(jobId, 'Resume processing completed successfully');
      await this.persistJob(jobId, job);

      // Save to D1 database
      try {
        await this.saveToDatabase(job);
        this.addLog(jobId, 'Saved to database');
      } catch (dbError: any) {
        console.error(`Failed to save job ${jobId} to database:`, dbError);
        this.addLog(jobId, `Database save warning: ${dbError.message}`);
        // Don't fail the job if database save fails
      }

      // Cache result in KV
      await this.cacheResult(jobId, job.result);

      this.processingJobId = null;

    } catch (error: any) {
      console.error(`Job ${jobId} processing error:`, error);
      
      // Increment retry count
      job.retryCount++;
      
      if (job.retryCount < job.maxRetries) {
        // Retry with exponential backoff
        const backoffMs = 2000 * Math.pow(2, job.retryCount - 1);
        job.status = 'pending';
        job.error = `Retry ${job.retryCount}/${job.maxRetries}: ${error.message}`;
        this.addLog(jobId, `Processing failed, retrying in ${backoffMs}ms...`);
        await this.persistJob(jobId, job);
        
        this.processingJobId = null;
        
        // Schedule retry
        setTimeout(() => {
          this.ctx.waitUntil(this.processJob(jobId));
        }, backoffMs);
      } else {
        // Max retries reached, mark as failed
        job.status = 'failed';
        job.error = error.message || 'Processing failed after maximum retries';
        job.completedAt = Date.now();
        this.addLog(jobId, `Processing failed: ${job.error}`);
        await this.persistJob(jobId, job);
        
        this.processingJobId = null;
      }
    }
  }

  /**
   * Download file from R2
   */
  private async downloadFile(key: string): Promise<ArrayBuffer> {
    const object = await this.env.RESUME_BUCKET.get(key);
    
    if (!object) {
      throw new Error(`File not found: ${key}`);
    }
    
    return await object.arrayBuffer();
  }

  /**
   * Cache result in KV
   */
  private async cacheResult(jobId: string, result: any): Promise<void> {
    try {
      await this.env.RESUME_CACHE.put(
        `result:${jobId}`,
        JSON.stringify(result),
        { expirationTtl: 86400 } // 24 hours
      );
    } catch (error) {
      console.error(`Failed to cache result for job ${jobId}:`, error);
      // Don't fail the job if caching fails
    }
  }

  /**
   * Persist job state to storage
   */
  private async persistJob(jobId: string, job: JobState): Promise<void> {
    this.jobs.set(jobId, job);
    await this.ctx.storage.put(`job:${jobId}`, job);
  }

  /**
   * Add log entry to job
   */
  private addLog(jobId: string, message: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      const timestamp = new Date().toISOString();
      job.logs.push(`[${timestamp}] ${message}`);
      
      // Keep only last 50 log entries
      if (job.logs.length > 50) {
        job.logs = job.logs.slice(-50);
      }
    }
  }

  /**
   * Initialize jobs from storage on startup
   */
  private async initializeFromStorage(): Promise<void> {
    const entries = await this.ctx.storage.list<JobState>({ prefix: 'job:' });
    entries.forEach((value, key) => {
      const jobId = key.replace('job:', '');
      this.jobs.set(jobId, value);
      
      // Resume processing for pending jobs
      if (value.status === 'pending' || value.status === 'processing') {
        // Reset processing status to pending for recovery
        value.status = 'pending';
        this.ctx.waitUntil(this.processJob(jobId));
      }
    });
  }

  /**
   * Simulate processing delay (for testing)
   */
  private async simulateProcessing(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save job result to D1 database
   */
  private async saveToDatabase(job: JobState): Promise<void> {
    if (!job.result || !job.result.parsedData) {
      return;
    }

    // Create or get user
    let user;
    if (job.userId) {
      user = await this.dbService.getUser(job.userId);
      if (!user) {
        // Create user if doesn't exist (in real app, user would be created during auth)
        user = await this.dbService.createUser({
          email: job.result.parsedData.profile?.email || 'unknown@example.com',
        });
      }
    } else {
      // Create anonymous user
      user = await this.dbService.createUser({
        email: job.result.parsedData.profile?.email || `anonymous-${job.sessionId}@example.com`,
      });
    }

    // Create resume session
    const session = await this.dbService.createResumeSession({
      userId: user.id,
      originalFilename: job.originalFileName,
      fileFormat: job.fileType,
      processingStatus: job.status,
      parsedData: job.result.parsedData,
    });

    // Create parsing metrics if available
    if (job.result.confidenceScores && Array.isArray(job.result.confidenceScores)) {
      const metrics = job.result.confidenceScores.map((score: any) => ({
        sessionId: session.id,
        fieldName: score.field,
        confidenceScore: score.score,
        wasEdited: false,
      }));

      if (metrics.length > 0) {
        await this.dbService.batchCreateParsingMetrics(metrics);
      }
    }
  }
}
