import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../[sessionId]/route';

// Mock services
vi.mock('@/services/queue', () => ({
  queueService: {
    getJobStatus: vi.fn(),
  },
}));

import { queueService } from '@/services/queue';

describe('/api/status/[sessionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return job status successfully for active job', async () => {
      const mockJobStatus = {
        status: 'active',
        progress: 75,
        data: null,
        error: null,
      };

      (queueService.getJobStatus as any).mockResolvedValue(mockJobStatus);

      const request = {} as NextRequest;
      const params = { sessionId: 'test-session-id' };

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.sessionId).toBe('test-session-id');
      expect(responseData.data.status).toBe('processing');
      expect(responseData.data.progress).toBe(75);
      expect(responseData.data.message).toContain('Parsing and analyzing');

      expect(queueService.getJobStatus).toHaveBeenCalledWith('test-session-id');
    });

    it('should return completed status with result data', async () => {
      const mockJobStatus = {
        status: 'completed',
        progress: 100,
        data: {
          success: true,
          parsedData: { profile: { name: 'John Doe' } },
        },
        error: null,
      };

      (queueService.getJobStatus as any).mockResolvedValue(mockJobStatus);

      const request = {} as NextRequest;
      const params = { sessionId: 'test-session-id' };

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.status).toBe('completed');
      expect(responseData.data.result).toEqual(mockJobStatus.data);
      expect(responseData.data.message).toBe('Resume processing completed successfully!');
    });

    it('should return queued status for waiting job', async () => {
      const mockJobStatus = {
        status: 'waiting',
        progress: 0,
        data: null,
        error: null,
      };

      (queueService.getJobStatus as any).mockResolvedValue(mockJobStatus);

      const request = {} as NextRequest;
      const params = { sessionId: 'test-session-id' };

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.status).toBe('queued');
      expect(responseData.data.message).toContain('processing queue');
    });

    it('should return 404 for non-existent session', async () => {
      const mockJobStatus = {
        status: 'not_found',
        progress: 0,
      };

      (queueService.getJobStatus as any).mockResolvedValue(mockJobStatus);

      const request = {} as NextRequest;
      const params = { sessionId: 'nonexistent-session' };

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('SESSION_NOT_FOUND');
    });

    it('should return 422 for failed job', async () => {
      const mockJobStatus = {
        status: 'failed',
        progress: 50,
        data: null,
        error: 'Processing failed due to invalid file format',
      };

      (queueService.getJobStatus as any).mockResolvedValue(mockJobStatus);

      const request = {} as NextRequest;
      const params = { sessionId: 'failed-session' };

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(422);
      expect(responseData.success).toBe(false);
      expect(responseData.data.status).toBe('failed');
      expect(responseData.error.code).toBe('PROCESSING_FAILED');
      expect(responseData.error.message).toBe('Processing failed due to invalid file format');
    });

    it('should return error for invalid session ID', async () => {
      const request = {} as NextRequest;
      const params = { sessionId: '' };

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error.code).toBe('INVALID_FILE_TYPE');
      expect(responseData.error.message).toBe('Invalid session ID provided.');
    });

    it('should handle service errors', async () => {
      (queueService.getJobStatus as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = {} as NextRequest;
      const params = { sessionId: 'test-session-id' };

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error.code).toBe('DATABASE_ERROR');
    });

    it('should return appropriate messages for different progress levels', async () => {
      const testCases = [
        { progress: 10, expectedMessage: 'Downloading and preparing' },
        { progress: 40, expectedMessage: 'Extracting text and content' },
        { progress: 70, expectedMessage: 'Parsing and analyzing' },
        { progress: 95, expectedMessage: 'Finalizing processing' },
      ];

      for (const testCase of testCases) {
        const mockJobStatus = {
          status: 'active',
          progress: testCase.progress,
          data: null,
          error: null,
        };

        (queueService.getJobStatus as any).mockResolvedValue(mockJobStatus);

        const request = {} as NextRequest;
        const params = { sessionId: 'test-session-id' };

        const response = await GET(request, { params });
        const responseData = await response.json();

        expect(responseData.data.message).toContain(testCase.expectedMessage);
      }
    });
  });
});