import { describe, it, expect } from 'vitest';
import { EncryptionService } from '../encryption';

describe('EncryptionService', () => {
  const encryptionService = new EncryptionService();
  const masterKey = 'test-master-key-for-encryption-testing';

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt text data correctly', async () => {
      const originalData = 'Sensitive user information';
      
      const encrypted = await encryptionService.encrypt(originalData, masterKey);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(originalData);
      
      const decrypted = await encryptionService.decrypt(encrypted, masterKey);
      expect(decrypted).toBe(originalData);
    });

    it('should produce different encrypted outputs for same input', async () => {
      const originalData = 'Test data';
      
      const encrypted1 = await encryptionService.encrypt(originalData, masterKey);
      const encrypted2 = await encryptionService.encrypt(originalData, masterKey);
      
      // Different due to random IV and salt
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both decrypt to same value
      const decrypted1 = await encryptionService.decrypt(encrypted1, masterKey);
      const decrypted2 = await encryptionService.decrypt(encrypted2, masterKey);
      expect(decrypted1).toBe(originalData);
      expect(decrypted2).toBe(originalData);
    });

    it('should fail to decrypt with wrong key', async () => {
      const originalData = 'Secret data';
      const encrypted = await encryptionService.encrypt(originalData, masterKey);
      
      await expect(
        encryptionService.decrypt(encrypted, 'wrong-key')
      ).rejects.toThrow();
    });
  });

  describe('encryptFile and decryptFile', () => {
    it('should encrypt and decrypt file buffers correctly', async () => {
      const originalFile = new TextEncoder().encode('File content data');
      
      const encrypted = await encryptionService.encryptFile(originalFile.buffer, masterKey);
      expect(encrypted).toBeTruthy();
      expect(encrypted.byteLength).toBeGreaterThan(originalFile.byteLength);
      
      const decrypted = await encryptionService.decryptFile(encrypted, masterKey);
      const decryptedText = new TextDecoder().decode(decrypted);
      expect(decryptedText).toBe('File content data');
    });

    it('should handle large file buffers', async () => {
      const largeData = new Uint8Array(1024 * 100); // 100KB
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }
      
      const encrypted = await encryptionService.encryptFile(largeData.buffer, masterKey);
      const decrypted = await encryptionService.decryptFile(encrypted, masterKey);
      
      const decryptedArray = new Uint8Array(decrypted);
      expect(decryptedArray.length).toBe(largeData.length);
      expect(decryptedArray[0]).toBe(largeData[0]);
      expect(decryptedArray[1000]).toBe(largeData[1000]);
    });
  });

  describe('hash', () => {
    it('should generate consistent hash for same input', async () => {
      const data = 'test@example.com';
      
      const hash1 = await encryptionService.hash(data);
      const hash2 = await encryptionService.hash(data);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', async () => {
      const hash1 = await encryptionService.hash('data1');
      const hash2 = await encryptionService.hash('data2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateToken', () => {
    it('should generate random tokens', () => {
      const token1 = encryptionService.generateToken(32);
      const token2 = encryptionService.generateToken(32);
      
      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
    });

    it('should generate tokens of specified length', () => {
      const token16 = encryptionService.generateToken(16);
      const token32 = encryptionService.generateToken(32);
      
      expect(token16.length).toBeLessThan(token32.length);
    });
  });
});
