import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataRetentionService } from '../data-retention';
import { CloudflareWorkersEnv } from '@/config/cloudflare-env';

describe('DataRetentionService', () => {
  let retentionService: DataRetentionService;
  let mockEnv: CloudflareWorkersEnv;
  let mockDb: any;
  let mockBucket: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(),
          all: vi.fn(() => ({ results: [] })),
          first: vi.fn(),
        })),
      })),
      exec: vi.fn(),
    };

    mockBucket = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      head: vi.fn(),
    };

    mockEnv = {
      DB: mockDb as any,
      RESUME_BUCKET: mockBucket as any,
      RESUME_CACHE: {} as any,
      JOB_QUEUE: {} as any,
      CLOUDFLARE_ACCOUNT_ID: 'test-account',
      ENCRYPTION_KEY: 'test-key',
    };

    retentionService = new DataRetentionService(mockEnv);
  });

  describe('deleteUserData', () => {
    it('should delete all user data successfully', async () => {
      // Mock database responses
      const mockSessions = [
        { id: 'session1', user_id: 'user1', original_filename: 'resume1.pdf' },
        { id: 'session2', user_id: 'user1', original_filename: 'resume2.pdf' },
      ];

      const mockPortfolios = [
        { id: 'portfolio1', user_id: 'user1' },
      ];

      // Setup mocks
      vi.spyOn(retentionService['db'], 'getResumeSessionsByUserId').mockResolvedValue(mockSessions as any);
      vi.spyOn(retentionService['db'], 'getPortfoliosByUserId').mockResolvedValue(mockPortfolios as any);
      vi.spyOn(retentionService['db'], 'deleteParsingMetricsBySessionId').mockResolvedValue(undefined);
      vi.spyOn(retentionService['db'], 'deletePortfolio').mockResolvedValue(undefined);
      vi.spyOn(retentionService['db'], 'deleteResumeSession').mockResolvedValue(undefined);
      vi.spyOn(retentionService['db'], 'deleteUser').mockResolvedValue(undefined);
      vi.spyOn(retentionService['db'], 'deleteUserConsent').mockResolvedValue(undefined);
      vi.spyOn(retentionService['fileStorage'], 'fileExists').mockResolvedValue(true);
      vi.spyOn(retentionService['fileStorage'], 'deleteFile').mockResolvedValue(undefined);

      const result = await retentionService.deleteUserData('user1');

      expect(result.success).toBe(true);
      expect(result.deletedItems.users).toBe(1);
      expect(result.deletedItems.sessions).toBe(2);
      expect(result.deletedItems.portfolios).toBe(1);
      expect(result.deletedItems.files).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle errors gracefully and continue deletion', async () => {
      const mockSessions = [
        { id: 'session1', user_id: 'user1', original_filename: 'resume1.pdf' },
      ];

      vi.spyOn(retentionService['db'], 'getResumeSessionsByUserId').mockResolvedValue(mockSessions as any);
      vi.spyOn(retentionService['db'], 'getPortfoliosByUserId').mockResolvedValue([]);
      vi.spyOn(retentionService['db'], 'deleteParsingMetricsBySessionId').mockRejectedValue(new Error('Metrics deletion failed'));
      vi.spyOn(retentionService['db'], 'deleteResumeSession').mockResolvedValue(undefined);
      vi.spyOn(retentionService['db'], 'deleteUser').mockResolvedValue(undefined);
      vi.spyOn(retentionService['db'], 'deleteUserConsent').mockResolvedValue(undefined);
      vi.spyOn(retentionService['fileStorage'], 'fileExists').mockResolvedValue(false);

      const result = await retentionService.deleteUserData('user1');

      expect(result.success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to delete metrics');
    });
  });

  describe('applyRetentionPolicy', () => {
    it('should delete source files when policy requires it', async () => {
      const mockSessions = [
        { id: 'session1', user_id: 'user1', original_filename: 'resume1.pdf' },
      ];

      vi.spyOn(retentionService['db'], 'getResumeSessionsByUserId').mockResolvedValue(mockSessions as any);
      vi.spyOn(retentionService['fileStorage'], 'fileExists').mockResolvedValue(true);
      vi.spyOn(retentionService['fileStorage'], 'deleteFile').mockResolvedValue(undefined);

      const result = await retentionService.applyRetentionPolicy('user1', {
        retainPortfolio: true,
        retainMetrics: true,
        deleteSourceFiles: true,
        deletePersonalData: false,
      });

      expect(result.success).toBe(true);
      expect(result.deletedItems.files).toBe(1);
      expect(result.deletedItems.portfolios).toBe(0);
    });

    it('should anonymize personal data when policy requires it', async () => {
      const mockSessions = [
        { id: 'session1', user_id: 'user1', original_filename: 'resume1.pdf' },
      ];

      vi.spyOn(retentionService['db'], 'getResumeSessionsByUserId').mockResolvedValue(mockSessions as any);
      vi.spyOn(retentionService['db'], 'updateResumeSession').mockResolvedValue(undefined);

      const result = await retentionService.applyRetentionPolicy('user1', {
        retainPortfolio: true,
        retainMetrics: true,
        deleteSourceFiles: false,
        deletePersonalData: true,
      });

      expect(result.success).toBe(true);
      expect(retentionService['db'].updateResumeSession).toHaveBeenCalledWith(
        'session1',
        { parsedData: undefined }
      );
    });

    it('should delete portfolios when not retained', async () => {
      const mockSessions = [{ id: 'session1', user_id: 'user1' }];
      const mockPortfolios = [{ id: 'portfolio1', user_id: 'user1' }];

      vi.spyOn(retentionService['db'], 'getResumeSessionsByUserId').mockResolvedValue(mockSessions as any);
      vi.spyOn(retentionService['db'], 'getPortfoliosByUserId').mockResolvedValue(mockPortfolios as any);
      vi.spyOn(retentionService['db'], 'deletePortfolio').mockResolvedValue(undefined);

      const result = await retentionService.applyRetentionPolicy('user1', {
        retainPortfolio: false,
        retainMetrics: true,
        deleteSourceFiles: false,
        deletePersonalData: false,
      });

      expect(result.success).toBe(true);
      expect(result.deletedItems.portfolios).toBe(1);
    });
  });

  describe('scheduleDeletion', () => {
    it('should schedule deletion for future date', async () => {
      vi.spyOn(retentionService['db'], 'createDeletionRequest').mockResolvedValue(undefined);

      const deletionDate = new Date();
      deletionDate.setHours(deletionDate.getHours() + 24);

      await retentionService.scheduleDeletion('user1', deletionDate);

      expect(retentionService['db'].createDeletionRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          scheduledFor: deletionDate,
          status: 'pending',
        })
      );
    });
  });

  describe('processPendingDeletions', () => {
    it('should process deletions scheduled for past dates', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const pendingDeletions = [
        {
          id: 'deletion1',
          userId: 'user1',
          scheduledFor: pastDate.toISOString(),
          status: 'pending',
        },
      ];

      vi.spyOn(retentionService['db'], 'getPendingDeletionRequests').mockResolvedValue(pendingDeletions);
      vi.spyOn(retentionService['db'], 'getResumeSessionsByUserId').mockResolvedValue([]);
      vi.spyOn(retentionService['db'], 'getPortfoliosByUserId').mockResolvedValue([]);
      vi.spyOn(retentionService['db'], 'deleteUser').mockResolvedValue(undefined);
      vi.spyOn(retentionService['db'], 'deleteUserConsent').mockResolvedValue(undefined);
      vi.spyOn(retentionService['db'], 'updateDeletionRequest').mockResolvedValue(undefined);

      const results = await retentionService.processPendingDeletions();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(retentionService['db'].updateDeletionRequest).toHaveBeenCalledWith(
        'deletion1',
        expect.objectContaining({
          status: 'completed',
        })
      );
    });

    it('should not process deletions scheduled for future dates', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);

      const pendingDeletions = [
        {
          id: 'deletion1',
          userId: 'user1',
          scheduledFor: futureDate.toISOString(),
          status: 'pending',
        },
      ];

      vi.spyOn(retentionService['db'], 'getPendingDeletionRequests').mockResolvedValue(pendingDeletions);

      const results = await retentionService.processPendingDeletions();

      expect(results).toHaveLength(0);
    });
  });

  describe('consent management', () => {
    it('should create user consent', async () => {
      vi.spyOn(retentionService['db'], 'getUserConsent').mockResolvedValue(null);
      vi.spyOn(retentionService['db'], 'createUserConsent').mockResolvedValue(undefined);

      await retentionService.updateUserConsent('user1', {
        dataProcessing: true,
        analytics: false,
        marketingEmails: false,
      });

      expect(retentionService['db'].createUserConsent).toHaveBeenCalled();
    });

    it('should update existing user consent', async () => {
      const existingConsent = {
        userId: 'user1',
        dataProcessing: true,
        analytics: false,
        marketingEmails: false,
      };

      vi.spyOn(retentionService['db'], 'getUserConsent').mockResolvedValue(existingConsent);
      vi.spyOn(retentionService['db'], 'updateUserConsent').mockResolvedValue(undefined);

      await retentionService.updateUserConsent('user1', {
        analytics: true,
      });

      expect(retentionService['db'].updateUserConsent).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          analytics: true,
        })
      );
    });
  });

  describe('exportUserData', () => {
    it('should export all user data', async () => {
      const mockUser = { id: 'user1', email: 'test@example.com' };
      const mockSessions = [{ id: 'session1' }];
      const mockPortfolios = [{ id: 'portfolio1' }];
      const mockConsent = { dataProcessing: true };

      vi.spyOn(retentionService['db'], 'getUserById').mockResolvedValue(mockUser as any);
      vi.spyOn(retentionService['db'], 'getResumeSessionsByUserId').mockResolvedValue(mockSessions as any);
      vi.spyOn(retentionService['db'], 'getPortfoliosByUserId').mockResolvedValue(mockPortfolios as any);
      vi.spyOn(retentionService['db'], 'getUserConsent').mockResolvedValue(mockConsent);
      vi.spyOn(retentionService['db'], 'getParsingMetricsBySessionId').mockResolvedValue([]);

      const result = await retentionService.exportUserData('user1');

      expect(result.user).toEqual(mockUser);
      expect(result.sessions).toEqual(mockSessions);
      expect(result.portfolios).toEqual(mockPortfolios);
      expect(result.consent).toEqual(mockConsent);
    });
  });

  describe('anonymizeOldData', () => {
    it('should anonymize sessions older than specified days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const oldSessions = [
        { id: 'session1', created_at: oldDate.toISOString() },
        { id: 'session2', created_at: oldDate.toISOString() },
      ];

      vi.spyOn(retentionService['db'], 'getResumeSessionsOlderThan').mockResolvedValue(oldSessions as any);
      vi.spyOn(retentionService['db'], 'updateResumeSession').mockResolvedValue(undefined);

      const count = await retentionService.anonymizeOldData(90);

      expect(count).toBe(2);
      expect(retentionService['db'].updateResumeSession).toHaveBeenCalledTimes(2);
    });
  });
});
