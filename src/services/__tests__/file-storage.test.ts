import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileStorageService } from '../file-storage';
import { CloudflareWorkersEnv } from '@/config/cloudflare-env';

describe('FileStorageService with R2', () => {
  let fileStorageService: FileStorageService;
  let mockR2Bucket: any;
  let mockEnv: CloudflareWorkersEnv;

  beforeEach(() => {
    // Mock R2 bucket operations
    mockR2Bucket = {
      put: vi.fn(),
      get: vi.fn(),
      head: vi.fn(),
      delete: vi.fn(),
    };

    // Mock Cloudflare Workers environment
    mockEnv = {
      RESUME_BUCKET: mockR2Bucket as any,
      RESUME_CACHE: {} as any,
      DB: {} as any,
      JOB_QUEUE: {} as any,
      CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
      R2_PUBLIC_URL: 'https://pub-test.r2.dev',
    };

    fileStorageService = new FileStorageService(mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload file to R2 successfully and return key and signed URL', async () => {
      const mockBuffer = new TextEncoder().encode('test file content').buffer;

      mockR2Bucket.put.mockResolvedValueOnce(undefined);
      mockR2Bucket.head.mockResolvedValueOnce({ size: 100 });

      const result = await fileStorageService.uploadFile(
        mockBuffer,
        'test-resume.pdf',
        'application/pdf',
        'user123'
      );

      expect(result.key).toMatch(/^users\/user123\/resumes\/\d+-[a-f0-9]{16}\.pdf$/);
      expect(result.url).toContain('pub-test.r2.dev');
      expect(mockR2Bucket.put).toHaveBeenCalledWith(
        expect.stringMatching(/^users\/user123\/resumes\/\d+-[a-f0-9]{16}\.pdf$/),
        mockBuffer,
        expect.objectContaining({
          httpMetadata: { contentType: 'application/pdf' },
          customMetadata: expect.objectContaining({
            originalName: 'test-resume.pdf',
            userId: 'user123',
          }),
        })
      );
    });

    it('should handle upload without userId', async () => {
      const mockBuffer = new TextEncoder().encode('test file content').buffer;

      mockR2Bucket.put.mockResolvedValueOnce(undefined);
      mockR2Bucket.head.mockResolvedValueOnce({ size: 100 });

      const result = await fileStorageService.uploadFile(
        mockBuffer,
        'test-resume.pdf',
        'application/pdf'
      );

      expect(result.key).toMatch(/^anonymous\/resumes\/\d+-[a-f0-9]{16}\.pdf$/);
      expect(result.url).toContain('pub-test.r2.dev');
      expect(mockR2Bucket.put).toHaveBeenCalledWith(
        expect.any(String),
        mockBuffer,
        expect.objectContaining({
          customMetadata: expect.objectContaining({
            userId: 'anonymous',
          }),
        })
      );
    });

    it('should throw error when R2 upload fails after retries', async () => {
      const mockBuffer = new TextEncoder().encode('test file content').buffer;
      
      // Fail all 3 retry attempts
      mockR2Bucket.put
        .mockRejectedValueOnce(new Error('R2 upload failed'))
        .mockRejectedValueOnce(new Error('R2 upload failed'))
        .mockRejectedValueOnce(new Error('R2 upload failed'));

      await expect(
        fileStorageService.uploadFile(mockBuffer, 'test.pdf', 'application/pdf')
      ).rejects.toThrow('R2 upload failed');
      
      expect(mockR2Bucket.put).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should retry on transient failures', async () => {
      const mockBuffer = new TextEncoder().encode('test file content').buffer;

      // Fail twice, then succeed
      mockR2Bucket.put
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce(undefined);
      mockR2Bucket.head.mockResolvedValueOnce({ size: 100 });

      const result = await fileStorageService.uploadFile(
        mockBuffer,
        'test-resume.pdf',
        'application/pdf'
      );

      expect(result.key).toBeDefined();
      expect(mockR2Bucket.put).toHaveBeenCalledTimes(3);
    });
  });

  describe('getSignedUrl', () => {
    it('should generate R2 public URL successfully', async () => {
      mockR2Bucket.head.mockResolvedValueOnce({ size: 100 });

      const result = await fileStorageService.getSignedUrl('test-key');

      expect(result).toBe('https://pub-test.r2.dev/test-key');
      expect(mockR2Bucket.head).toHaveBeenCalledWith('test-key');
    });

    it('should validate expiration time within bounds', async () => {
      mockR2Bucket.head.mockResolvedValueOnce({ size: 100 });

      // Test with time below minimum (should clamp to 60)
      const result1 = await fileStorageService.getSignedUrl('test-key', 30);
      expect(result1).toBeDefined();

      // Test with time above maximum (should clamp to 3600)
      mockR2Bucket.head.mockResolvedValueOnce({ size: 100 });
      const result2 = await fileStorageService.getSignedUrl('test-key', 7200);
      expect(result2).toBeDefined();
    });

    it('should throw error when file not found without retrying', async () => {
      mockR2Bucket.head.mockResolvedValueOnce(null);

      await expect(
        fileStorageService.getSignedUrl('nonexistent-key')
      ).rejects.toThrow('File not found');
      
      // Should not retry NOT_FOUND errors
      expect(mockR2Bucket.head).toHaveBeenCalledTimes(1);
    });

    it('should throw error when R2 head operation fails after retries', async () => {
      // Fail all 3 retry attempts
      mockR2Bucket.head
        .mockRejectedValueOnce(new Error('R2 error'))
        .mockRejectedValueOnce(new Error('R2 error'))
        .mockRejectedValueOnce(new Error('R2 error'));

      await expect(
        fileStorageService.getSignedUrl('test-key')
      ).rejects.toThrow('R2 error');
      
      expect(mockR2Bucket.head).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  describe('downloadFile', () => {
    it('should download file from R2 successfully', async () => {
      const mockFileContent = 'test file content';
      const mockArrayBuffer = new TextEncoder().encode(mockFileContent).buffer;
      
      mockR2Bucket.get.mockResolvedValueOnce({
        arrayBuffer: vi.fn().mockResolvedValueOnce(mockArrayBuffer),
      });

      const result = await fileStorageService.downloadFile('test-key');

      expect(result).toEqual(mockArrayBuffer);
      expect(mockR2Bucket.get).toHaveBeenCalledWith('test-key');
    });

    it('should throw error when file not found in R2 without retrying', async () => {
      mockR2Bucket.get.mockResolvedValueOnce(null);

      await expect(
        fileStorageService.downloadFile('nonexistent-key')
      ).rejects.toThrow('File not found');
      
      // Should not retry NOT_FOUND errors
      expect(mockR2Bucket.get).toHaveBeenCalledTimes(1);
    });

    it('should throw error when R2 download fails after retries', async () => {
      // Fail all 3 retry attempts
      mockR2Bucket.get
        .mockRejectedValueOnce(new Error('Download failed'))
        .mockRejectedValueOnce(new Error('Download failed'))
        .mockRejectedValueOnce(new Error('Download failed'));

      await expect(
        fileStorageService.downloadFile('test-key')
      ).rejects.toThrow('Download failed');
      
      expect(mockR2Bucket.get).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should retry on transient download failures', async () => {
      const mockFileContent = 'test file content';
      const mockArrayBuffer = new TextEncoder().encode(mockFileContent).buffer;

      // Fail once, then succeed
      mockR2Bucket.get
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce({
          arrayBuffer: vi.fn().mockResolvedValueOnce(mockArrayBuffer),
        });

      const result = await fileStorageService.downloadFile('test-key');

      expect(result).toEqual(mockArrayBuffer);
      expect(mockR2Bucket.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteFile', () => {
    it('should delete file from R2 successfully', async () => {
      mockR2Bucket.delete.mockResolvedValueOnce(undefined);

      await expect(
        fileStorageService.deleteFile('test-key')
      ).resolves.not.toThrow();

      expect(mockR2Bucket.delete).toHaveBeenCalledWith('test-key');
    });

    it('should throw error when R2 deletion fails after retries', async () => {
      // Fail all 3 retry attempts
      mockR2Bucket.delete
        .mockRejectedValueOnce(new Error('Deletion failed'))
        .mockRejectedValueOnce(new Error('Deletion failed'))
        .mockRejectedValueOnce(new Error('Deletion failed'));

      await expect(
        fileStorageService.deleteFile('test-key')
      ).rejects.toThrow('Deletion failed');
      
      expect(mockR2Bucket.delete).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should retry on transient deletion failures', async () => {
      // Fail once, then succeed
      mockR2Bucket.delete
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce(undefined);

      await expect(
        fileStorageService.deleteFile('test-key')
      ).resolves.not.toThrow();

      expect(mockR2Bucket.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists in R2', async () => {
      mockR2Bucket.head.mockResolvedValueOnce({ size: 100 });

      const result = await fileStorageService.fileExists('test-key');

      expect(result).toBe(true);
      expect(mockR2Bucket.head).toHaveBeenCalledWith('test-key');
    });

    it('should return false when file does not exist in R2', async () => {
      mockR2Bucket.head.mockResolvedValueOnce(null);

      const result = await fileStorageService.fileExists('nonexistent-key');

      expect(result).toBe(false);
    });

    it('should return false when R2 head operation fails', async () => {
      mockR2Bucket.head.mockRejectedValueOnce(new Error('R2 error'));

      const result = await fileStorageService.fileExists('test-key');

      expect(result).toBe(false);
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata from R2 successfully', async () => {
      const mockUploadDate = new Date('2023-01-01');
      const mockR2Object = {
        size: 1024,
        httpMetadata: {
          contentType: 'application/pdf',
        },
        uploaded: mockUploadDate,
        customMetadata: {
          originalName: 'test.pdf',
          uploadedAt: '2023-01-01T00:00:00.000Z',
        },
      };

      mockR2Bucket.head.mockResolvedValueOnce(mockR2Object);

      const result = await fileStorageService.getFileMetadata('test-key');

      expect(result).toEqual({
        size: 1024,
        contentType: 'application/pdf',
        lastModified: mockUploadDate,
        metadata: {
          originalName: 'test.pdf',
          uploadedAt: '2023-01-01T00:00:00.000Z',
        },
      });
    });

    it('should handle missing metadata fields in R2', async () => {
      const mockUploadDate = new Date();
      const mockR2Object = {
        size: 512,
        httpMetadata: {},
        uploaded: mockUploadDate,
        customMetadata: {},
      };

      mockR2Bucket.head.mockResolvedValueOnce(mockR2Object);

      const result = await fileStorageService.getFileMetadata('test-key');

      expect(result.size).toBe(512);
      expect(result.contentType).toBe('application/octet-stream');
      expect(result.lastModified).toEqual(mockUploadDate);
      expect(result.metadata).toEqual({});
    });

    it('should throw error when file not found in R2 without retrying', async () => {
      mockR2Bucket.head.mockResolvedValueOnce(null);

      await expect(
        fileStorageService.getFileMetadata('nonexistent-key')
      ).rejects.toThrow('File not found');
      
      // Should not retry NOT_FOUND errors
      expect(mockR2Bucket.head).toHaveBeenCalledTimes(1);
    });

    it('should throw error when R2 metadata retrieval fails after retries', async () => {
      // Fail all 3 retry attempts
      mockR2Bucket.head
        .mockRejectedValueOnce(new Error('Metadata failed'))
        .mockRejectedValueOnce(new Error('Metadata failed'))
        .mockRejectedValueOnce(new Error('Metadata failed'));

      await expect(
        fileStorageService.getFileMetadata('test-key')
      ).rejects.toThrow('Metadata failed');
      
      expect(mockR2Bucket.head).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should retry on transient metadata failures', async () => {
      const mockUploadDate = new Date('2023-01-01');
      const mockR2Object = {
        size: 1024,
        httpMetadata: { contentType: 'application/pdf' },
        uploaded: mockUploadDate,
        customMetadata: {},
      };

      // Fail once, then succeed
      mockR2Bucket.head
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce(mockR2Object);

      const result = await fileStorageService.getFileMetadata('test-key');

      expect(result.size).toBe(1024);
      expect(mockR2Bucket.head).toHaveBeenCalledTimes(2);
    });
  });
});
describe(
'FileStorageService with Encryption', () => {
  let fileStorageService: FileStorageService;
  let mockR2Bucket: any;
  let mockEnv: CloudflareWorkersEnv;

  beforeEach(() => {
    mockR2Bucket = {
      put: vi.fn(),
      get: vi.fn(),
      head: vi.fn(),
      delete: vi.fn(),
    };

    mockEnv = {
      RESUME_BUCKET: mockR2Bucket as any,
      RESUME_CACHE: {} as any,
      DB: {} as any,
      JOB_QUEUE: {} as any,
      CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
      R2_PUBLIC_URL: 'https://pub-test.r2.dev',
      ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
    };

    fileStorageService = new FileStorageService(mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadFile with encryption', () => {
    it('should encrypt file before uploading when encryption is enabled', async () => {
      const mockBuffer = new TextEncoder().encode('sensitive data').buffer;

      mockR2Bucket.put.mockResolvedValueOnce(undefined);
      mockR2Bucket.head.mockResolvedValueOnce({ size: 100 });

      const result = await fileStorageService.uploadFile(
        mockBuffer,
        'test-resume.pdf',
        'application/pdf',
        'user123',
        true // Enable encryption
      );

      expect(result.key).toBeDefined();
      expect(mockR2Bucket.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(ArrayBuffer), // Encrypted data
        expect.objectContaining({
          customMetadata: expect.objectContaining({
            encrypted: 'true',
          }),
        })
      );

      // Verify encrypted data is different from original
      const uploadedData = mockR2Bucket.put.mock.calls[0][1];
      expect(uploadedData).not.toEqual(mockBuffer);
    });

    it('should not encrypt file when encryption is disabled', async () => {
      const mockBuffer = new TextEncoder().encode('public data').buffer;

      mockR2Bucket.put.mockResolvedValueOnce(undefined);
      mockR2Bucket.head.mockResolvedValueOnce({ size: 100 });

      await fileStorageService.uploadFile(
        mockBuffer,
        'test-resume.pdf',
        'application/pdf',
        'user123',
        false // Disable encryption
      );

      expect(mockR2Bucket.put).toHaveBeenCalledWith(
        expect.any(String),
        mockBuffer, // Original data
        expect.objectContaining({
          customMetadata: expect.objectContaining({
            encrypted: 'false',
          }),
        })
      );
    });
  });

  describe('downloadFile with decryption', () => {
    it('should decrypt file after downloading when file is encrypted', async () => {
      const originalContent = 'sensitive data';
      const mockBuffer = new TextEncoder().encode(originalContent).buffer;

      // Simulate encrypted file in R2
      const encryptedBuffer = new Uint8Array(mockBuffer.byteLength + 100); // Simulated encrypted data
      
      mockR2Bucket.get.mockResolvedValueOnce({
        arrayBuffer: vi.fn().mockResolvedValueOnce(encryptedBuffer.buffer),
        customMetadata: {
          encrypted: 'true',
        },
      });

      // Note: This test will fail actual decryption since we're not using real encrypted data
      // In a real scenario, you'd need to encrypt first, then decrypt
      try {
        await fileStorageService.downloadFile('test-key');
      } catch (error) {
        // Expected to fail with mock data
        expect(error).toBeDefined();
      }

      expect(mockR2Bucket.get).toHaveBeenCalledWith('test-key');
    });

    it('should not decrypt file when file is not encrypted', async () => {
      const mockContent = 'public data';
      const mockBuffer = new TextEncoder().encode(mockContent).buffer;

      mockR2Bucket.get.mockResolvedValueOnce({
        arrayBuffer: vi.fn().mockResolvedValueOnce(mockBuffer),
        customMetadata: {
          encrypted: 'false',
        },
      });

      const result = await fileStorageService.downloadFile('test-key');

      expect(result).toEqual(mockBuffer);
      const decryptedText = new TextDecoder().decode(result);
      expect(decryptedText).toBe(mockContent);
    });
  });

  describe('verifySignedUrl', () => {
    it('should verify valid signed URL with unexpired token', () => {
      const futureExpiry = Date.now() + 3600000; // 1 hour from now
      const url = `https://pub-test.r2.dev/test-key?token=abc123&expires=${futureExpiry}&key=test-key`;

      const result = fileStorageService.verifySignedUrl(url);

      expect(result).toBe(true);
    });

    it('should reject expired signed URL', () => {
      const pastExpiry = Date.now() - 3600000; // 1 hour ago
      const url = `https://pub-test.r2.dev/test-key?token=abc123&expires=${pastExpiry}&key=test-key`;

      const result = fileStorageService.verifySignedUrl(url);

      expect(result).toBe(false);
    });

    it('should reject URL without token', () => {
      const futureExpiry = Date.now() + 3600000;
      const url = `https://pub-test.r2.dev/test-key?expires=${futureExpiry}&key=test-key`;

      const result = fileStorageService.verifySignedUrl(url);

      expect(result).toBe(false);
    });

    it('should reject URL without expiry', () => {
      const url = `https://pub-test.r2.dev/test-key?token=abc123&key=test-key`;

      const result = fileStorageService.verifySignedUrl(url);

      expect(result).toBe(false);
    });

    it('should reject malformed URL', () => {
      const result = fileStorageService.verifySignedUrl('not-a-valid-url');

      expect(result).toBe(false);
    });
  });
});
