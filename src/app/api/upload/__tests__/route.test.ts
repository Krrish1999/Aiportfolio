import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock services - must be defined before imports
vi.mock('@/services/file-storage', () => ({
  createFileStorageService: vi.fn(() => ({
    uploadFile: vi.fn(),
  })),
}));

vi.mock('@/services/queue', () => ({
  queueService: {
    addResumeProcessingJob: vi.fn(),
  },
}));

vi.mock('@/utils/validation', () => ({
  validateFile: vi.fn(),
}));

// Import after mocks
import { POST } from '../route';
import { createFileStorageService } from '@/services/file-storage';
import { queueService } from '@/services/queue';
import { validateFile } from '@/utils/validation';

// Mock crypto.randomUUID
const originalCrypto = global.crypto;
const originalRandomUUID = global.crypto.randomUUID;

describe('/api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock crypto.randomUUID for each test
    global.crypto.randomUUID = vi.fn(() => 'test-session-id') as any;
  });

  afterEach(() => {
    // Restore original crypto
    global.crypto.randomUUID = originalRandomUUID;
  });

  describe('POST', () => {
    it('should upload file successfully', async () => {
      // Mock validation first
      vi.mocked(validateFile).mockReturnValue({ success: true });

      // Mock file with arrayBuffer method
      const mockFile = {
        name: 'resume.pdf',
        size: 1024,
        type: 'application/pdf',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as unknown as File;

      // Mock form data
      const formData = new FormData();
      formData.append('file', mockFile);
      formData.append('userId', 'user123');

      // Mock Cloudflare Workers environment
      const mockEnv = {
        RESUME_BUCKET: {},
        RESUME_CACHE: {},
        DB: {},
        JOB_QUEUE: {},
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
      };

      // Mock request with Cloudflare env
      const request = {
        formData: vi.fn().mockResolvedValue(formData),
        env: mockEnv,
      } as unknown as NextRequest;

      // Mock file storage
      const mockFileStorage = {
        uploadFile: vi.fn().mockResolvedValue({
          key: 'test-file-key',
          url: 'https://r2.cloudflarestorage.com/test-file-key',
        }),
      };
      vi.mocked(createFileStorageService).mockReturnValue(mockFileStorage as any);

      // Mock queue service
      vi.mocked(queueService.addResumeProcessingJob).mockResolvedValue({
        id: 'job-123',
      } as any);

      const response = await POST(request);
      const responseData = await response.json() as any;

      expect(response.status).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.data.sessionId).toBe('test-session-id');
      expect(responseData.data.fileName).toBe('resume.pdf');
      expect(responseData.data.status).toBe('uploaded');
      expect(responseData.data.fileUrl).toBe('https://r2.cloudflarestorage.com/test-file-key');

      expect(createFileStorageService).toHaveBeenCalledWith(mockEnv);
      
      expect(mockFileStorage.uploadFile).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        'resume.pdf',
        'application/pdf',
        'user123'
      );

      expect(queueService.addResumeProcessingJob).toHaveBeenCalledWith({
        sessionId: 'test-session-id',
        userId: 'user123',
        fileKey: 'test-file-key',
        originalFileName: 'resume.pdf',
        fileType: 'application/pdf',
        fileSize: mockFile.size,
      });
    });

    it('should handle upload without userId', async () => {
      // Mock validation first
      vi.mocked(validateFile).mockReturnValue({ success: true });

      const mockFile = {
        name: 'resume.pdf',
        size: 1024,
        type: 'application/pdf',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as unknown as File;

      const formData = new FormData();
      formData.append('file', mockFile);

      const mockEnv = {
        RESUME_BUCKET: {},
        RESUME_CACHE: {},
        DB: {},
        JOB_QUEUE: {},
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
      };

      const request = {
        formData: vi.fn().mockResolvedValue(formData),
        env: mockEnv,
      } as unknown as NextRequest;
      
      const mockFileStorage2 = {
        uploadFile: vi.fn().mockResolvedValue({
          key: 'test-file-key',
          url: 'https://r2.cloudflarestorage.com/test-file-key',
        }),
      };
      vi.mocked(createFileStorageService).mockReturnValue(mockFileStorage2 as any);
      
      vi.mocked(queueService.addResumeProcessingJob).mockResolvedValue({
        id: 'job-123',
      } as any);

      const response = await POST(request);
      const responseData = await response.json() as any;

      expect(response.status).toBe(201);
      expect(responseData.success).toBe(true);

      expect(mockFileStorage2.uploadFile).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        'resume.pdf',
        'application/pdf',
        undefined
      );
    });

    it('should return error when no file provided', async () => {
      const formData = new FormData();

      const mockEnv = {
        RESUME_BUCKET: {},
        RESUME_CACHE: {},
        DB: {},
        JOB_QUEUE: {},
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
      };

      const request = {
        formData: vi.fn().mockResolvedValue(formData),
        env: mockEnv,
      } as unknown as NextRequest;

      const response = await POST(request);
      const responseData = await response.json() as any;

      expect(response.status).toBe(400);
      expect(responseData.success).toBeUndefined();
      expect(responseData.error.code).toBe('INVALID_FILE_TYPE');
      expect(responseData.error.message).toBe('Please select a file to upload.');
    });

    it('should return error for invalid file type', async () => {
      const mockFile = {
        name: 'resume.txt',
        size: 1024,
        type: 'text/html', // Invalid type
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as unknown as File;

      const formData = new FormData();
      formData.append('file', mockFile);

      const mockEnv = {
        RESUME_BUCKET: {},
        RESUME_CACHE: {},
        DB: {},
        JOB_QUEUE: {},
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
      };

      const request = {
        formData: vi.fn().mockResolvedValue(formData),
        env: mockEnv,
      } as unknown as NextRequest;

      const response = await POST(request);
      const responseData = await response.json() as any;

      expect(response.status).toBe(400);
      expect(responseData.error.code).toBe('INVALID_FILE_TYPE');
      expect(responseData.error.message).toBe('Please upload a PDF, DOCX, or TXT file.');
    });

    it('should return error when file validation fails', async () => {
      // Mock validation to fail
      vi.mocked(validateFile).mockReturnValue({
        success: false,
        error: 'File size must be less than 10MB',
      });

      const mockFile = {
        name: 'resume.pdf',
        size: 11 * 1024 * 1024, // 11MB - too large
        type: 'application/pdf',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as unknown as File;

      const formData = new FormData();
      formData.append('file', mockFile);

      const mockEnv = {
        RESUME_BUCKET: {},
        RESUME_CACHE: {},
        DB: {},
        JOB_QUEUE: {},
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
      };

      const request = {
        formData: vi.fn().mockResolvedValue(formData),
        env: mockEnv,
      } as unknown as NextRequest;

      const response = await POST(request);
      const responseData = await response.json() as any;

      expect(response.status).toBe(413);
      expect(responseData.error.code).toBe('FILE_TOO_LARGE');
      expect(responseData.error.message).toBe('File size must be less than 10MB');
    });

    it('should handle file storage error', async () => {
      // Mock validation first
      vi.mocked(validateFile).mockReturnValue({ success: true });

      const mockFile = {
        name: 'resume.pdf',
        size: 1024,
        type: 'application/pdf',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as unknown as File;

      const formData = new FormData();
      formData.append('file', mockFile);

      const mockEnv = {
        RESUME_BUCKET: {},
        RESUME_CACHE: {},
        DB: {},
        JOB_QUEUE: {},
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
      };

      const request = {
        formData: vi.fn().mockResolvedValue(formData),
        env: mockEnv,
      } as unknown as NextRequest;
      
      const mockFileStorage3 = {
        uploadFile: vi.fn().mockRejectedValue(new Error('R2 storage error')),
      };
      vi.mocked(createFileStorageService).mockReturnValue(mockFileStorage3 as any);

      const response = await POST(request);
      const responseData = await response.json() as any;

      expect(response.status).toBe(500);
      expect(responseData.error.code).toBe('DATABASE_ERROR');
    });

    it('should handle queue service error', async () => {
      // Mock validation first
      vi.mocked(validateFile).mockReturnValue({ success: true });

      const mockFile = {
        name: 'resume.pdf',
        size: 1024,
        type: 'application/pdf',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as unknown as File;

      const formData = new FormData();
      formData.append('file', mockFile);

      const mockEnv = {
        RESUME_BUCKET: {},
        RESUME_CACHE: {},
        DB: {},
        JOB_QUEUE: {},
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
      };

      const request = {
        formData: vi.fn().mockResolvedValue(formData),
        env: mockEnv,
      } as unknown as NextRequest;
      
      const mockFileStorage4 = {
        uploadFile: vi.fn().mockResolvedValue({
          key: 'test-file-key',
          url: 'https://r2.cloudflarestorage.com/test-file-key',
        }),
      };
      vi.mocked(createFileStorageService).mockReturnValue(mockFileStorage4 as any);
      
      vi.mocked(queueService.addResumeProcessingJob).mockRejectedValue(
        new Error('Queue error')
      );

      const response = await POST(request);
      const responseData = await response.json() as any;

      expect(response.status).toBe(500);
      expect(responseData.error.code).toBe('DATABASE_ERROR');
    });

    it('should return error when Cloudflare environment is not available', async () => {
      const formData = new FormData();

      const request = {
        formData: vi.fn().mockResolvedValue(formData),
        env: undefined, // No Cloudflare environment
      } as unknown as NextRequest;

      const response = await POST(request);
      const responseData = await response.json() as any;

      expect(response.status).toBe(500);
      expect(responseData.error.code).toBe('DATABASE_ERROR');
      expect(responseData.error.message).toBe('Service temporarily unavailable. Please try again later.');
    });
  });
});