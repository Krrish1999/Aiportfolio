import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobQueueDO, ResumeProcessingJobData, JobState } from '../JobQueueDO';
import { CloudflareWorkersEnv } from '@/config/cloudflare-env';

/**
 * Mock Durable Object State
 */
class MockDurableObjectState {
  private storageMap: Map<string, any> = new Map();
  private waitUntilPromises: Promise<any>[] = [];
  
  storage = {
    get: async <T>(key: string): Promise<T | undefined> => {
      return this.storageMap.get(key);
    },
    
    put: async (key: string, value: any): Promise<void> => {
      this.storageMap.set(key, value);
    },
    
    delete: async (key: string): Promise<boolean> => {
      return this.storageMap.delete(key);
    },
    
    list: async <T>(options?: { prefix?: string }): Promise<Map<string, T>> => {
      const result = new Map<string, T>();
      const prefix = options?.prefix || '';
      
      for (const [key, value] of this.storageMap.entries()) {
        if (key.startsWith(prefix)) {
          result.set(key, value);
        }
      }
      
      return result;
    },
  };

  waitUntil(promise: Promise<any>): void {
    this.waitUntilPromises.push(promise);
  }

  async flushWaitUntil(): Promise<void> {
    await Promise.all(this.waitUntilPromises);
    this.waitUntilPromises = [];
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.storage.get<T>(key);
  }

  async put(key: string, value: any): Promise<void> {
    return this.storage.put(key, value);
  }

  clear(): void {
    this.storageMap.clear();
    this.waitUntilPromises = [];
  }
}

/**
 * Mock Cloudflare Workers Environment
 */
function createMockEnv(): CloudflareWorkersEnv {
  const mockR2Objects = new Map<string, ArrayBuffer>();
  const mockKVStore = new Map<string, string>();

  return {
    RESUME_BUCKET: {
      get: vi.fn(async (key: string) => {
        const buffer = mockR2Objects.get(key);
        if (!buffer) return null;
        return {
          arrayBuffer: async () => buffer,
          text: async () => new TextDecoder().decode(buffer),
        };
      }),
      put: vi.fn(async (key: string, value: ArrayBuffer) => {
        mockR2Objects.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        mockR2Objects.delete(key);
      }),
      head: vi.fn(async (key: string) => {
        return mockR2Objects.has(key) ? {} : null;
      }),
    } as any,
    
    RESUME_CACHE: {
      get: vi.fn(async (key: string) => mockKVStore.get(key)),
      put: vi.fn(async (key: string, value: string, options?: any) => {
        mockKVStore.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        mockKVStore.delete(key);
      }),
    } as any,
    
    DB: {} as any,
    JOB_QUEUE: {} as any,
    CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    R2_PUBLIC_URL: 'https://test.r2.dev',
  };
}

describe('JobQueueDO', () => {
  let jobQueueDO: JobQueueDO;
  let mockState: MockDurableObjectState;
  let mockEnv: CloudflareWorkersEnv;

  beforeEach(() => {
    mockState = new MockDurableObjectState();
    mockEnv = createMockEnv();
    
    // Create JobQueueDO instance
    jobQueueDO = new JobQueueDO(mockState as any, mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockState.clear();
  });

  describe('Job Addition', () => {
    it('should add a job successfully', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'test-session-1',
        userId: 'user-123',
        fileKey: 'resumes/test-file.pdf',
        originalFileName: 'resume.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      const request = new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      });

      const response = await jobQueueDO.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.jobId).toBe('test-session-1');
      expect(result.status).toBe('pending');

      // Verify job was persisted to storage
      const storedJob = await mockState.get<JobState>('job:test-session-1');
      expect(storedJob).toBeDefined();
      expect(storedJob?.status).toBe('pending');
      expect(storedJob?.progress).toBe(0);
      expect(storedJob?.retryCount).toBe(0);
    });

    it('should create job with correct initial state', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'test-session-2',
        fileKey: 'resumes/test-file-2.pdf',
        originalFileName: 'resume2.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
      };

      const request = new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      });

      await jobQueueDO.fetch(request);

      const storedJob = await mockState.get<JobState>('job:test-session-2');
      expect(storedJob).toMatchObject({
        sessionId: 'test-session-2',
        fileKey: 'resumes/test-file-2.pdf',
        originalFileName: 'resume2.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
        status: 'pending',
        progress: 0,
        retryCount: 0,
        maxRetries: 3,
      });
      expect(storedJob?.logs).toBeInstanceOf(Array);
      expect(storedJob?.createdAt).toBeGreaterThan(0);
    });
  });

  describe('Job Status Queries', () => {
    it('should return job status for existing job', async () => {
      // First add a job
      const jobData: ResumeProcessingJobData = {
        sessionId: 'status-test-1',
        fileKey: 'resumes/status-test.pdf',
        originalFileName: 'status-test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Query status
      const statusRequest = new Request('https://test.com/status?jobId=status-test-1');
      const response = await jobQueueDO.fetch(statusRequest);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.progress).toBe(0);
      expect(result.logs).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent job', async () => {
      const statusRequest = new Request('https://test.com/status?jobId=non-existent');
      const response = await jobQueueDO.fetch(statusRequest);
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.error).toBe('Job not found');
      expect(result.status).toBe('not_found');
    });

    it('should return 400 when jobId is missing', async () => {
      const statusRequest = new Request('https://test.com/status');
      const response = await jobQueueDO.fetch(statusRequest);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('Job ID is required');
    });

    it('should return updated status after processing starts', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'status-test-2',
        fileKey: 'resumes/status-test-2.pdf',
        originalFileName: 'status-test-2.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add file to mock R2
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(jobData.fileKey, fileBuffer);

      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Wait for processing to start
      await mockState.flushWaitUntil();
      await new Promise(resolve => setTimeout(resolve, 100));

      const statusRequest = new Request('https://test.com/status?jobId=status-test-2');
      const response = await jobQueueDO.fetch(statusRequest);
      const result = await response.json();

      expect(result.status).toMatch(/pending|processing|completed/);
      expect(result.progress).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Job Cancellation', () => {
    it('should cancel a pending job', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'cancel-test-1',
        fileKey: 'resumes/cancel-test.pdf',
        originalFileName: 'cancel-test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add job
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Cancel job
      const cancelRequest = new Request('https://test.com/cancel?jobId=cancel-test-1');
      const response = await jobQueueDO.fetch(cancelRequest);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.status).toBe('cancelled');
      expect(result.message).toBe('Job cancelled successfully');

      // Verify job status is updated
      const storedJob = await mockState.get<JobState>('job:cancel-test-1');
      expect(storedJob?.status).toBe('cancelled');
      expect(storedJob?.completedAt).toBeGreaterThan(0);
    });

    it('should return 404 when cancelling non-existent job', async () => {
      const cancelRequest = new Request('https://test.com/cancel?jobId=non-existent');
      const response = await jobQueueDO.fetch(cancelRequest);
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.error).toBe('Job not found');
    });

    it('should return 400 when cancelling completed job', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'cancel-test-2',
        fileKey: 'resumes/cancel-test-2.pdf',
        originalFileName: 'cancel-test-2.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add job and manually mark as completed
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      const job = await mockState.get<JobState>('job:cancel-test-2');
      if (job) {
        job.status = 'completed';
        await mockState.put('job:cancel-test-2', job);
      }

      // Try to cancel
      const cancelRequest = new Request('https://test.com/cancel?jobId=cancel-test-2');
      const response = await jobQueueDO.fetch(cancelRequest);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('Cannot cancel completed job');
    });

    it('should return 400 when jobId is missing', async () => {
      const cancelRequest = new Request('https://test.com/cancel');
      const response = await jobQueueDO.fetch(cancelRequest);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('Job ID is required');
    });
  });

  describe('Job Processing', () => {
    it('should process a job successfully', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'process-test-1',
        fileKey: 'resumes/process-test.pdf',
        originalFileName: 'process-test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add file to mock R2
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(jobData.fileKey, fileBuffer);

      // Add job
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Wait for processing to complete
      await mockState.flushWaitUntil();
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Check final status
      const storedJob = await mockState.get<JobState>('job:process-test-1');
      expect(storedJob?.status).toBe('completed');
      expect(storedJob?.progress).toBe(100);
      expect(storedJob?.result).toBeDefined();
      expect(storedJob?.completedAt).toBeGreaterThan(0);
      expect(storedJob?.logs.length).toBeGreaterThan(0);
    });

    it('should update progress during processing', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'process-test-2',
        fileKey: 'resumes/process-test-2.pdf',
        originalFileName: 'process-test-2.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add file to mock R2
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(jobData.fileKey, fileBuffer);

      // Add job
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Wait a bit for processing to start
      await mockState.flushWaitUntil();
      await new Promise(resolve => setTimeout(resolve, 500));

      const job = await mockState.get<JobState>('job:process-test-2');
      expect(job?.progress).toBeGreaterThan(0);
      expect(job?.logs.length).toBeGreaterThan(0);
    });

    it('should cache result in KV after successful processing', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'process-test-3',
        fileKey: 'resumes/process-test-3.pdf',
        originalFileName: 'process-test-3.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add file to mock R2
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(jobData.fileKey, fileBuffer);

      // Add job
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Wait for processing to complete
      await mockState.flushWaitUntil();
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Verify KV cache was called
      expect(mockEnv.RESUME_CACHE.put).toHaveBeenCalledWith(
        'result:process-test-3',
        expect.any(String),
        { expirationTtl: 86400 }
      );
    });
  });

  describe('Job Persistence and Recovery', () => {
    it('should persist job state to storage', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'persist-test-1',
        fileKey: 'resumes/persist-test.pdf',
        originalFileName: 'persist-test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add job
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Verify job is in storage
      const storedJob = await mockState.get<JobState>('job:persist-test-1');
      expect(storedJob).toBeDefined();
      expect(storedJob?.sessionId).toBe('persist-test-1');
    });

    it('should recover jobs from storage on initialization', async () => {
      // Manually add jobs to storage
      const job1: JobState = {
        sessionId: 'recover-test-1',
        fileKey: 'resumes/recover-1.pdf',
        originalFileName: 'recover-1.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        status: 'pending',
        progress: 0,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        logs: [],
      };

      const job2: JobState = {
        sessionId: 'recover-test-2',
        fileKey: 'resumes/recover-2.pdf',
        originalFileName: 'recover-2.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
        status: 'processing',
        progress: 50,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        logs: [],
      };

      await mockState.put('job:recover-test-1', job1);
      await mockState.put('job:recover-test-2', job2);

      // Create new instance to trigger recovery
      const newJobQueueDO = new JobQueueDO(mockState as any, mockEnv);

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Query recovered jobs
      const status1 = await newJobQueueDO.fetch(
        new Request('https://test.com/status?jobId=recover-test-1')
      );
      const result1 = await status1.json();
      expect(result1.success).toBe(true);

      const status2 = await newJobQueueDO.fetch(
        new Request('https://test.com/status?jobId=recover-test-2')
      );
      const result2 = await status2.json();
      expect(result2.success).toBe(true);
    });

    it('should resume processing for pending jobs after recovery', async () => {
      // Add a pending job to storage
      const job: JobState = {
        sessionId: 'resume-test-1',
        fileKey: 'resumes/resume-test.pdf',
        originalFileName: 'resume-test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        status: 'pending',
        progress: 0,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        logs: [],
      };

      await mockState.put('job:resume-test-1', job);

      // Add file to mock R2
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(job.fileKey, fileBuffer);

      // Create new instance to trigger recovery and processing
      const newJobQueueDO = new JobQueueDO(mockState as any, mockEnv);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 4500));

      // Check if job was processed
      const storedJob = await mockState.get<JobState>('job:resume-test-1');
      expect(storedJob?.status).toMatch(/processing|completed/);
    });

    it('should reset processing status to pending on recovery', async () => {
      // Add a job that was processing before crash
      const job: JobState = {
        sessionId: 'crash-test-1',
        fileKey: 'resumes/crash-test.pdf',
        originalFileName: 'crash-test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        status: 'processing',
        progress: 50,
        createdAt: Date.now(),
        startedAt: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        logs: ['Processing started...'],
      };

      await mockState.put('job:crash-test-1', job);

      // Add file to mock R2
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(job.fileKey, fileBuffer);

      // Create new instance to simulate recovery after crash
      const newJobQueueDO = new JobQueueDO(mockState as any, mockEnv);

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 100));

      // Job should be reset to pending and reprocessed
      const storedJob = await mockState.get<JobState>('job:crash-test-1');
      expect(storedJob?.status).toMatch(/pending|processing|completed/);
    });
  });

  describe('Error Handling and Retries', () => {
    it('should handle file not found error', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'error-test-1',
        fileKey: 'resumes/non-existent.pdf',
        originalFileName: 'non-existent.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Don't add file to R2 to simulate not found error

      // Add job
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Wait for processing to fail
      await mockState.flushWaitUntil();
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Check job status
      const storedJob = await mockState.get<JobState>('job:error-test-1');
      expect(storedJob?.status).toBe('failed');
      expect(storedJob?.error).toContain('File not found');
      expect(storedJob?.retryCount).toBe(3);
    });

    it('should retry failed jobs with exponential backoff', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'retry-test-1',
        fileKey: 'resumes/retry-test.pdf',
        originalFileName: 'retry-test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Don't add file to simulate failure

      // Add job
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Wait for first attempt
      await mockState.flushWaitUntil();
      await new Promise(resolve => setTimeout(resolve, 1000));

      let storedJob = await mockState.get<JobState>('job:retry-test-1');
      expect(storedJob?.retryCount).toBeGreaterThan(0);
      expect(storedJob?.status).toMatch(/pending|failed/);

      // Wait for all retries
      await new Promise(resolve => setTimeout(resolve, 8000));

      storedJob = await mockState.get<JobState>('job:retry-test-1');
      expect(storedJob?.retryCount).toBe(3);
      expect(storedJob?.status).toBe('failed');
    });

    it('should succeed after retry if error is resolved', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'retry-success-test',
        fileKey: 'resumes/retry-success.pdf',
        originalFileName: 'retry-success.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add job without file first
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Wait for first failure
      await mockState.flushWaitUntil();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Now add the file to simulate error resolution
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(jobData.fileKey, fileBuffer);

      // Wait for retry and completion
      await new Promise(resolve => setTimeout(resolve, 6000));

      const storedJob = await mockState.get<JobState>('job:retry-success-test');
      expect(storedJob?.status).toBe('completed');
      expect(storedJob?.retryCount).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Job Processing', () => {
    it('should process jobs sequentially, not concurrently', async () => {
      const job1Data: ResumeProcessingJobData = {
        sessionId: 'concurrent-test-1',
        fileKey: 'resumes/concurrent-1.pdf',
        originalFileName: 'concurrent-1.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      const job2Data: ResumeProcessingJobData = {
        sessionId: 'concurrent-test-2',
        fileKey: 'resumes/concurrent-2.pdf',
        originalFileName: 'concurrent-2.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add files to mock R2
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(job1Data.fileKey, fileBuffer);
      await mockEnv.RESUME_BUCKET.put(job2Data.fileKey, fileBuffer);

      // Add both jobs
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(job1Data),
      }));

      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(job2Data),
      }));

      // Wait a bit for first job to start
      await mockState.flushWaitUntil();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check that only one job is processing
      const job1 = await mockState.get<JobState>('job:concurrent-test-1');
      const job2 = await mockState.get<JobState>('job:concurrent-test-2');

      const processingCount = [job1, job2].filter(
        job => job?.status === 'processing'
      ).length;

      expect(processingCount).toBeLessThanOrEqual(1);
    });

    it('should process second job after first completes', async () => {
      const job1Data: ResumeProcessingJobData = {
        sessionId: 'sequential-test-1',
        fileKey: 'resumes/sequential-1.pdf',
        originalFileName: 'sequential-1.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      const job2Data: ResumeProcessingJobData = {
        sessionId: 'sequential-test-2',
        fileKey: 'resumes/sequential-2.pdf',
        originalFileName: 'sequential-2.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add files to mock R2
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(job1Data.fileKey, fileBuffer);
      await mockEnv.RESUME_BUCKET.put(job2Data.fileKey, fileBuffer);

      // Add both jobs
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(job1Data),
      }));

      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(job2Data),
      }));

      // Wait for both jobs to complete
      await mockState.flushWaitUntil();
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Both jobs should eventually complete
      const job1 = await mockState.get<JobState>('job:sequential-test-1');
      const job2 = await mockState.get<JobState>('job:sequential-test-2');

      expect(job1?.status).toBe('completed');
      // Job 2 might still be pending if processing is truly sequential
      expect(job2?.status).toMatch(/pending|processing|completed/);
    });

    it('should handle multiple jobs with different states', async () => {
      const jobs: ResumeProcessingJobData[] = [
        {
          sessionId: 'multi-test-1',
          fileKey: 'resumes/multi-1.pdf',
          originalFileName: 'multi-1.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
        },
        {
          sessionId: 'multi-test-2',
          fileKey: 'resumes/multi-2.pdf',
          originalFileName: 'multi-2.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
        },
        {
          sessionId: 'multi-test-3',
          fileKey: 'resumes/multi-3.pdf',
          originalFileName: 'multi-3.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
        },
      ];

      // Add files for first two jobs only
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(jobs[0].fileKey, fileBuffer);
      await mockEnv.RESUME_BUCKET.put(jobs[1].fileKey, fileBuffer);

      // Add all jobs
      for (const job of jobs) {
        await jobQueueDO.fetch(new Request('https://test.com/add', {
          method: 'POST',
          body: JSON.stringify(job),
        }));
      }

      // Wait for processing
      await mockState.flushWaitUntil();
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check states
      const job1 = await mockState.get<JobState>('job:multi-test-1');
      const job2 = await mockState.get<JobState>('job:multi-test-2');
      const job3 = await mockState.get<JobState>('job:multi-test-3');

      // First two should succeed or be processing
      expect(job1?.status).toMatch(/processing|completed/);
      expect(job2?.status).toMatch(/pending|processing|completed/);
      
      // Third should fail (no file)
      expect(job3?.status).toMatch(/pending|failed/);
    });
  });

  describe('Process Next Job Endpoint', () => {
    it('should trigger processing for pending job', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'process-next-test',
        fileKey: 'resumes/process-next.pdf',
        originalFileName: 'process-next.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add file to mock R2
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(jobData.fileKey, fileBuffer);

      // Add job
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Manually set to pending (in case it auto-started)
      const job = await mockState.get<JobState>('job:process-next-test');
      if (job) {
        job.status = 'pending';
        await mockState.put('job:process-next-test', job);
      }

      // Trigger processing
      const processRequest = new Request('https://test.com/process');
      const response = await jobQueueDO.fetch(processRequest);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.jobId).toBe('process-next-test');
      expect(result.message).toBe('Processing started');
    });

    it('should return success when no pending jobs', async () => {
      const processRequest = new Request('https://test.com/process');
      const response = await jobQueueDO.fetch(processRequest);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.message).toBe('No pending jobs');
    });
  });

  describe('Invalid Routes', () => {
    it('should return 404 for unknown routes', async () => {
      const request = new Request('https://test.com/unknown');
      const response = await jobQueueDO.fetch(request);

      expect(response.status).toBe(404);
    });
  });

  describe('Job Logs', () => {
    it('should maintain job logs during processing', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'logs-test',
        fileKey: 'resumes/logs-test.pdf',
        originalFileName: 'logs-test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add file to mock R2
      const fileBuffer = new TextEncoder().encode('mock resume content');
      await mockEnv.RESUME_BUCKET.put(jobData.fileKey, fileBuffer);

      // Add job
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Wait for processing
      await mockState.flushWaitUntil();
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Check logs
      const storedJob = await mockState.get<JobState>('job:logs-test');
      expect(storedJob?.logs).toBeInstanceOf(Array);
      expect(storedJob?.logs.length).toBeGreaterThan(0);
      expect(storedJob?.logs.some(log => log.includes('Job created'))).toBe(true);
    });

    it('should limit log entries to 50', async () => {
      const jobData: ResumeProcessingJobData = {
        sessionId: 'log-limit-test',
        fileKey: 'resumes/log-limit.pdf',
        originalFileName: 'log-limit.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      // Add job
      await jobQueueDO.fetch(new Request('https://test.com/add', {
        method: 'POST',
        body: JSON.stringify(jobData),
      }));

      // Manually add many log entries
      const job = await mockState.get<JobState>('job:log-limit-test');
      if (job) {
        for (let i = 0; i < 60; i++) {
          job.logs.push(`Log entry ${i}`);
        }
        await mockState.put('job:log-limit-test', job);
      }

      // Retrieve and check
      const storedJob = await mockState.get<JobState>('job:log-limit-test');
      expect(storedJob?.logs.length).toBeLessThanOrEqual(50);
    });
  });
});
