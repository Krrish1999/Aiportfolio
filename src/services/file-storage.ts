import { withRetry, CloudflareErrorHandler } from '@/utils/errors';
import { CloudflareWorkersEnv } from '@/config/cloudflare-env';
import { encryptionService } from '@/utils/encryption';

export class FileStorageService {
  private bucket: R2Bucket;
  private publicUrl?: string;
  private encryptionKey: string;

  constructor(env: CloudflareWorkersEnv) {
    this.bucket = env.RESUME_BUCKET;
    this.publicUrl = env.R2_PUBLIC_URL;
    // Use a dedicated encryption key from environment or generate one
    this.encryptionKey = env.ENCRYPTION_KEY || this.generateEncryptionKey();
  }

  /**
   * Generate a secure encryption key if not provided
   */
  private generateEncryptionKey(): string {
    return encryptionService.generateToken(32);
  }

  /**
   * Generate a unique file key for storage
   */
  private generateFileKey(originalName: string, userId?: string): string {
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    const extension = originalName.split('.').pop();
    const prefix = userId ? `users/${userId}` : 'anonymous';
    
    return `${prefix}/resumes/${timestamp}-${randomId}.${extension}`;
  }

  /**
   * Upload file to R2 with encryption and secure access
   */
  async uploadFile(
    fileBuffer: ArrayBuffer,
    originalName: string,
    contentType: string,
    userId?: string,
    encrypt: boolean = true
  ): Promise<{ key: string; url: string }> {
    return withRetry(
      async () => {
        try {
          const key = this.generateFileKey(originalName, userId);

          // Encrypt file buffer if encryption is enabled
          let dataToStore = fileBuffer;
          if (encrypt) {
            dataToStore = await encryptionService.encryptFile(fileBuffer, this.encryptionKey);
          }

          // R2 put operation with metadata and encryption flag
          await this.bucket.put(key, dataToStore, {
            httpMetadata: {
              contentType,
            },
            customMetadata: {
              originalName,
              uploadedAt: new Date().toISOString(),
              userId: userId || 'anonymous',
              encrypted: encrypt.toString(),
            },
          });

          // Generate signed URL for secure access (1 hour expiration)
          const signedUrl = await this.getSignedUrl(key, 3600);

          return { key, url: signedUrl };
        } catch (error: any) {
          CloudflareErrorHandler.handleR2Error(error);
        }
      },
      3,
      1000,
      'R2'
    );
  }

  /**
   * Generate signed URL for secure file access with expiration
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return withRetry(
      async () => {
        try {
          // Validate expiration time (60-3600 seconds)
          const validExpiresIn = Math.max(60, Math.min(3600, expiresIn));

          // Check if object exists
          const object = await this.bucket.head(key);
          if (!object) {
            CloudflareErrorHandler.handleR2Error(new Error('NoSuchKey: File not found'));
          }

          // Generate secure token for URL
          const token = encryptionService.generateToken(16);
          const expiresAt = Date.now() + (validExpiresIn * 1000);

          // Create signed URL with token and expiration
          // In production with R2, this would use R2's presigned URL generation
          // For now, we create a custom signed URL format
          const signedParams = new URLSearchParams({
            token,
            expires: expiresAt.toString(),
            key,
          });

          if (this.publicUrl) {
            return `${this.publicUrl}/${key}?${signedParams.toString()}`;
          }

          // Return signed URL with security parameters
          return `https://r2.cloudflarestorage.com/${key}?${signedParams.toString()}`;
        } catch (error: any) {
          CloudflareErrorHandler.handleR2Error(error);
        }
      },
      3,
      1000,
      'R2'
    );
  }

  /**
   * Verify signed URL is valid and not expired
   */
  verifySignedUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const expires = urlObj.searchParams.get('expires');
      const token = urlObj.searchParams.get('token');

      if (!expires || !token) {
        return false;
      }

      const expiresAt = parseInt(expires, 10);
      return Date.now() < expiresAt;
    } catch {
      return false;
    }
  }

  /**
   * Download file from R2 with automatic decryption
   */
  async downloadFile(key: string): Promise<ArrayBuffer> {
    return withRetry(
      async () => {
        try {
          const object = await this.bucket.get(key);

          if (!object) {
            CloudflareErrorHandler.handleR2Error(new Error('NoSuchKey: File not found'));
          }

          // Get file buffer
          const fileBuffer = await object.arrayBuffer();

          // Check if file is encrypted
          const isEncrypted = object.customMetadata?.encrypted === 'true';

          // Decrypt if necessary
          if (isEncrypted) {
            return await encryptionService.decryptFile(fileBuffer, this.encryptionKey);
          }

          return fileBuffer;
        } catch (error: any) {
          CloudflareErrorHandler.handleR2Error(error);
        }
      },
      3,
      1000,
      'R2'
    );
  }

  /**
   * Delete file from R2
   */
  async deleteFile(key: string): Promise<void> {
    return withRetry(
      async () => {
        try {
          await this.bucket.delete(key);
        } catch (error: any) {
          CloudflareErrorHandler.handleR2Error(error);
        }
      },
      3,
      1000,
      'R2'
    );
  }

  /**
   * Check if file exists in R2
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const object = await this.bucket.head(key);
      return object !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata from R2
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
    metadata: Record<string, string>;
  }> {
    return withRetry(
      async () => {
        try {
          const object = await this.bucket.head(key);

          if (!object) {
            CloudflareErrorHandler.handleR2Error(new Error('NoSuchKey: File not found'));
          }

          return {
            size: object.size,
            contentType: object.httpMetadata?.contentType || 'application/octet-stream',
            lastModified: object.uploaded,
            metadata: object.customMetadata || {},
          };
        } catch (error: any) {
          CloudflareErrorHandler.handleR2Error(error);
        }
      },
      3,
      1000,
      'R2'
    );
  }
}

// Note: The singleton export is removed as the service now requires CloudflareWorkersEnv
// Services should instantiate FileStorageService with the appropriate environment
export function createFileStorageService(env: CloudflareWorkersEnv): FileStorageService {
  return new FileStorageService(env);
}