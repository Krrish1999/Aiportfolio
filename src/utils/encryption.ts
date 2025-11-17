/**
 * Encryption utilities for securing sensitive data at rest
 * Uses Web Crypto API for encryption/decryption operations
 */

export class EncryptionService {
  private algorithm = 'AES-GCM';
  private keyLength = 256;
  private ivLength = 12; // 96 bits for GCM

  /**
   * Derive encryption key from master key using PBKDF2
   */
  private async deriveKey(masterKey: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(masterKey),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data using AES-GCM
   * Returns base64-encoded encrypted data with IV and salt prepended
   */
  async encrypt(data: string, masterKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));

    // Derive encryption key
    const key = await this.deriveKey(masterKey, salt);

    // Encrypt data
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: this.algorithm,
        iv,
      },
      key,
      dataBuffer
    );

    // Combine salt + IV + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encryptedBuffer.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedBuffer), salt.length + iv.length);

    // Return base64-encoded result
    return this.arrayBufferToBase64(combined);
  }

  /**
   * Decrypt data using AES-GCM
   * Expects base64-encoded data with salt and IV prepended
   */
  async decrypt(encryptedData: string, masterKey: string): Promise<string> {
    // Decode base64
    const combined = this.base64ToArrayBuffer(encryptedData);

    // Extract salt, IV, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 16 + this.ivLength);
    const encrypted = combined.slice(16 + this.ivLength);

    // Derive decryption key
    const key = await this.deriveKey(masterKey, salt);

    // Decrypt data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: this.algorithm,
        iv,
      },
      key,
      encrypted
    );

    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Encrypt file buffer
   */
  async encryptFile(fileBuffer: ArrayBuffer, masterKey: string): Promise<ArrayBuffer> {
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));

    // Derive encryption key
    const key = await this.deriveKey(masterKey, salt);

    // Encrypt file
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: this.algorithm,
        iv,
      },
      key,
      fileBuffer
    );

    // Combine salt + IV + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encryptedBuffer.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedBuffer), salt.length + iv.length);

    return combined.buffer;
  }

  /**
   * Decrypt file buffer
   */
  async decryptFile(encryptedBuffer: ArrayBuffer, masterKey: string): Promise<ArrayBuffer> {
    const combined = new Uint8Array(encryptedBuffer);

    // Extract salt, IV, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 16 + this.ivLength);
    const encrypted = combined.slice(16 + this.ivLength);

    // Derive decryption key
    const key = await this.deriveKey(masterKey, salt);

    // Decrypt file
    return crypto.subtle.decrypt(
      {
        name: this.algorithm,
        iv,
      },
      key,
      encrypted
    );
  }

  /**
   * Hash sensitive data for comparison (one-way)
   */
  async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return this.arrayBufferToBase64(new Uint8Array(hashBuffer));
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return this.arrayBufferToBase64(bytes);
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    const binary = String.fromCharCode(...buffer);
    return btoa(binary);
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();
