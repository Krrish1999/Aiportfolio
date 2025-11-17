import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueueService } from '../queue';
import { CloudflareWorkersEnv } from '@/config/cloudflare-env';

describe('QueueService with Durable Objects', () => {
  let queueService: QueueService;
  let mockEnv: CloudflareWorkersEnv;
  let mockDurableObjectStub: any;
  let mockKVNamespace: any;
  let mockDurableObjectNamespace: any;

  beforeEach(() => {
    // Mock Durable Object stub
    mockDurableObjectStub = {
      fetch: vi.fn(),
    };

    // Mock Durable Object namespace
    mockDurableObjectNamespace = {
      idFromName: vi.fn().mockReturnValue({ name: 'global-queue' }),
      get: vi.fn().mockReturnValue(mockDurableObjectStub),
    };

    // Mock KV namespace
    mockKVNamespace = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    // Mock Cloudflare Workers environment
    mockEnv = {
      RESUME_BUCKET: {} as any,
      RESUME_CACHE: mockKVNamespace as any,
      DB: {} as any,
      JOB_QUEUE: mockDurableObjectNamespace as any,
      CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    };

    queueService = new QueueService(mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('addResumeProcessingJob', () => {
    it('should add job to Durable Object queue successfully', async () => {
      const jobData = {
        sessionId: 'test-session-id',
        userId: 'user123',
        fileKey: 'test-file-key',
        originalFileName: 'resume.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      mockDurableObjectStub.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: jobData.sessionId, status: 'pending' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      mockKVNamespace.put.mockResolvedValueOnce(undefined);

      const result = await queueService.addResumeProcessingJob(jobData);

      expect(mockDurableObjectNamespace.idFromName).toHaveBeenCalledWith('global-queue');
      expect(mockDurableObjectStub.fetch).toHaveBeenCalledWith(
        'https://queue/add',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(jobData),
        })
      );
      expect(result).toEqual({ jobId: jobData.sessionId, status: 'pending' });
      expect(mockKVNamespace.put).toHaveBeenCalledWith(
        `job:${jobData.sessionId}`,
        expect.any(String),
        { expirationTtl: 86400 }
      );
    });

    it('should throw error when Durable Object returns error', async () => {
      const jobData = {
        sessionId: 'test-session-id',
        fileKey: 'test-file-key',
        originalFileName: 'resume.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      mockDurableObjectStub.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Queue full' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(
        queueService.addResumeProcessingJob(jobData)
      ).rejects.toThrow('Failed to add job to queue');
    });

    it('should handle KV caching failures gracefully', async () => {
      const jobData = {
        sessionId: 'test-session-id',
        fileKey: 'test-file-key',
        originalFileName: 'resume.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      mockDurableObjectStub.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: jobData.sessionId, status: 'pending' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // KV fails but should not affect job creation
      mockKVNamespace.put.mockRejectedValueOnce(new Error('KV error'));

      const result = await queueService.addResumeProcessingJob(jobData);

      expect(result).toEqual({ jobId: jobData.sessionId, status: 'pending' });
    });
  });

  describe('getJobStatus', () => {
    it('should return cached result if available', async () => {
      const cachedResult = { parsedData: { profile: { name: 'John Doe' } } };
      mockKVNamespace.get.mockResolvedValueOnce(JSON.stringify(cachedResult));

      const result = await queueService.getJobStatus('test-job-id');

      expect(result).toEqual({
        status: 'completed',
        progress: 100,
        data: cachedResult,
      });
      expect(mockKVNamespace.get).toHaveBeenCalledWith('result:test-job-id');
      expect(mockDurableObjectStub.fetch).not.toHaveBeenCalled();
    });

    it('should query Durable Object when no cached result', async () => {
      mockKVNamespace.get.mockResolvedValueOnce(null);
      mockDurableObjectStub.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'processing',
            progress: 50,
            logs: ['Parsing PDF...'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await queueService.getJobStatus('test-job-id');

      expect(result).toEqual({
        status: 'processing',
        progress: 50,
        data: undefined,
        error: undefined,
        logs: ['Parsing PDF...'],
      });
      expect(mockDurableObjectStub.fetch).toHaveBeenCalledWith(
        'https://queue/status?jobId=test-job-id',
        { method: 'GET' }
      );
    });

    it('should return not_found when Durable Object returns 404', async () => {
      mockKVNamespace.get.mockResolvedValueOnce(null);
      mockDurableObjectStub.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await queueService.getJobStatus('nonexistent-job');

      expect(result).toEqual({
        status: 'not_found',
        progress: 0,
      });
    });

    it('should return job with error status', async () => {
      mockKVNamespace.get.mockResolvedValueOnce(null);
      mockDurableObjectStub.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'failed',
            progress: 30,
            error: 'PDF parsing failed',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await queueService.getJobStatus('test-job-id');

      expect(result).toEqual({
        status: 'failed',
        progress: 30,
        data: undefined,
        error: 'PDF parsing failed',
        logs: undefined,
      });
    });

    it('should handle KV read failures gracefully', async () => {
      mockKVNamespace.get.mockRejectedValueOnce(new Error('KV error'));
      mockDurableObjectStub.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'processing', progress: 50 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await queueService.getJobStatus('test-job-id');

      expect(result.status).toBe('processing');
      expect(result.progress).toBe(50);
    });
  });

  describe('cancelJob', () => {
    it('should cancel job via Durable Object successfully', async () => {
      mockDurableObjectStub.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      mockKVNamespace.delete.mockResolvedValueOnce(undefined);

      await queueService.cancelJob('test-job-id');

      expect(mockDurableObjectStub.fetch).toHaveBeenCalledWith(
        'https://queue/cancel?jobId=test-job-id',
        { method: 'POST' }
      );
      expect(mockKVNamespace.delete).toHaveBeenCalledWith('job:test-job-id');
      expect(mockKVNamespace.delete).toHaveBeenCalledWith('result:test-job-id');
    });

    it('should handle canceling non-existent job', async () => {
      mockDurableObjectStub.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(
        queueService.cancelJob('nonexistent-job')
      ).resolves.not.toThrow();
    });

    it('should throw error when Durable Object cancellation fails', async () => {
      mockDurableObjectStub.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Internal error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(
        queueService.cancelJob('test-job-id')
      ).rejects.toThrow('Failed to cancel job');
    });

    it('should handle KV deletion failures gracefully', async () => {
      mockDurableObjectStub.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      mockKVNamespace.delete.mockRejectedValueOnce(new Error('KV error'));

      await expect(
        queueService.cancelJob('test-job-id')
      ).resolves.not.toThrow();
    });
  });
});