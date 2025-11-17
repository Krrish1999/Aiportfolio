import { createError, CloudflareErrorHandler } from '@/utils/errors';
import { CloudflareWorkersEnv } from '@/config/cloudflare-env';

// Job data interfaces
export interface ResumeProcessingJobData {
  sessionId: string;
  userId?: string;
  fileKey: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
}

export interface JobProgress {
  step: string;
  progress: number;
  message: string;
}

export interface JobResult {
  success: boolean;
  sessionId: string;
  parsedData?: any;
  error?: string;
}

/**
 * QueueService - Client for communicating with JobQueueDO Durable Objects
 * 
 * This service replaces the Bull/Redis queue implementation with Cloudflare
 * Durable Objects for stateful job processing at the edge.
 */
export class QueueService {
  private env: CloudflareWorkersEnv;
  private queueNamespace: DurableObjectNamespace;

  constructor(env: CloudflareWorkersEnv) {
    this.env = env;
    this.queueNamespace = env.JOB_QUEUE;
  }

  /**
   * Get Durable Object stub for the global queue
   */
  private getQueueStub(): DurableObjectStub {
    // Use a single global queue instance for all jobs
    const id = this.queueNamespace.idFromName('global-queue');
    return this.queueNamespace.get(id);
  }

  /**
   * Add resume processing job to queue
   */
  async addResumeProcessingJob(
    jobData: ResumeProcessingJobData
  ): Promise<{ jobId: string; status: string }> {
    try {
      const stub = this.getQueueStub();
      
      const response = await stub.fetch('https://queue/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData),
      });

      if (!response.ok) {
        const error: any = await response.json();
        throw new Error(error.error || 'Failed to add job');
      }

      const result: any = await response.json();
      
      // Also cache job info in KV for quick lookups
      await this.cacheJobInfo(jobData.sessionId, {
        sessionId: jobData.sessionId,
        status: 'pending',
        createdAt: Date.now(),
      });

      return result;
    } catch (error: any) {
      throw createError(
        'DATABASE_ERROR',
        `Failed to add job to queue: ${error.message}`,
        'Failed to start processing. Please try again.'
      );
    }
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    data?: any;
    error?: string;
    logs?: string[];
  }> {
    try {
      // First try to get from KV cache for faster response
      const cachedResult = await this.getCachedResult(jobId);
      if (cachedResult) {
        return {
          status: 'completed',
          progress: 100,
          data: cachedResult,
        };
      }

      // Query Durable Object for current status
      const stub = this.getQueueStub();
      
      const response = await stub.fetch(`https://queue/status?jobId=${jobId}`, {
        method: 'GET',
      });

      if (response.status === 404) {
        return { status: 'not_found', progress: 0 };
      }

      if (!response.ok) {
        const error: any = await response.json();
        throw new Error(error.error || 'Failed to get job status');
      }

      const result: any = await response.json();
      
      return {
        status: result.status,
        progress: result.progress,
        data: result.result,
        error: result.error,
        logs: result.logs,
      };
    } catch (error: any) {
      // If error is about job not found, return not_found status
      if (error.message?.includes('not found')) {
        return { status: 'not_found', progress: 0 };
      }
      
      throw createError(
        'DATABASE_ERROR',
        `Failed to get job status: ${error.message}`,
        'Failed to get processing status. Please try again.'
      );
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    try {
      const stub = this.getQueueStub();
      
      const response = await stub.fetch(`https://queue/cancel?jobId=${jobId}`, {
        method: 'POST',
      });

      if (response.status === 404) {
        // Job not found, consider it already cancelled/completed
        return;
      }

      if (!response.ok) {
        const error: any = await response.json();
        throw new Error(error.error || 'Failed to cancel job');
      }

      // Clear cached data
      await this.clearCachedData(jobId);
    } catch (error: any) {
      throw createError(
        'DATABASE_ERROR',
        `Failed to cancel job: ${error.message}`,
        'Failed to cancel processing. Please try again.'
      );
    }
  }

  /**
   * Cache job info in KV for quick lookups
   */
  private async cacheJobInfo(jobId: string, info: any): Promise<void> {
    try {
      await this.env.RESUME_CACHE.put(
        `job:${jobId}`,
        JSON.stringify(info),
        { expirationTtl: 86400 } // 24 hours
      );
    } catch (error: any) {
      // Log KV errors but don't fail the operation
      console.error(`Failed to cache job info for ${jobId}:`, error);
      try {
        CloudflareErrorHandler.handleKVError(error);
      } catch {
        // Swallow KV errors for caching operations
      }
    }
  }

  /**
   * Get cached result from KV
   */
  private async getCachedResult(jobId: string): Promise<any | null> {
    try {
      const cached = await this.env.RESUME_CACHE.get(`result:${jobId}`);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error: any) {
      console.error(`Failed to get cached result for ${jobId}:`, error);
      try {
        CloudflareErrorHandler.handleKVError(error);
      } catch {
        // Swallow KV errors for read operations
      }
      return null;
    }
  }

  /**
   * Clear cached data for a job
   */
  private async clearCachedData(jobId: string): Promise<void> {
    try {
      await Promise.all([
        this.env.RESUME_CACHE.delete(`job:${jobId}`),
        this.env.RESUME_CACHE.delete(`result:${jobId}`),
      ]);
    } catch (error: any) {
      console.error(`Failed to clear cached data for ${jobId}:`, error);
      try {
        CloudflareErrorHandler.handleKVError(error);
      } catch {
        // Swallow KV errors for delete operations
      }
    }
  }
}

/**
 * Create QueueService instance with Cloudflare environment
 */
export function createQueueService(env: CloudflareWorkersEnv): QueueService {
  return new QueueService(env);
}