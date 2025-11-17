/**
 * Data retention and deletion service
 * Handles user data deletion, selective retention, and privacy controls
 */

import { CloudflareWorkersEnv } from '@/config/cloudflare-env';
import { DatabaseService } from './database';
import { createFileStorageService } from './file-storage';

export interface DataRetentionPolicy {
  retainPortfolio: boolean;
  retainMetrics: boolean;
  deleteSourceFiles: boolean;
  deletePersonalData: boolean;
}

export interface DeletionResult {
  success: boolean;
  deletedItems: {
    users: number;
    sessions: number;
    portfolios: number;
    files: number;
    metrics: number;
  };
  errors: string[];
  completedAt: Date;
}

export interface UserConsent {
  userId: string;
  dataProcessing: boolean;
  analytics: boolean;
  marketingEmails: boolean;
  consentedAt: Date;
  updatedAt: Date;
}

export class DataRetentionService {
  private db: DatabaseService;
  private fileStorage: ReturnType<typeof createFileStorageService>;

  constructor(env: CloudflareWorkersEnv) {
    this.db = new DatabaseService(env);
    this.fileStorage = createFileStorageService(env);
  }

  /**
   * Delete all user data completely
   * Requirement 7.2: Remove all personal information within 24 hours
   */
  async deleteUserData(userId: string): Promise<DeletionResult> {
    const result: DeletionResult = {
      success: true,
      deletedItems: {
        users: 0,
        sessions: 0,
        portfolios: 0,
        files: 0,
        metrics: 0,
      },
      errors: [],
      completedAt: new Date(),
    };

    try {
      // 1. Get all resume sessions for the user
      const sessions = await this.db.getResumeSessionsByUserId(userId);

      // 2. Delete all files associated with sessions
      for (const session of sessions) {
        try {
          // Extract file key from session metadata or construct it
          const fileKey = `users/${userId}/resumes/${session.original_filename}`;
          const fileExists = await this.fileStorage.fileExists(fileKey);
          
          if (fileExists) {
            await this.fileStorage.deleteFile(fileKey);
            result.deletedItems.files++;
          }
        } catch (error) {
          result.errors.push(`Failed to delete file for session ${session.id}: ${error}`);
        }
      }

      // 3. Delete parsing metrics
      for (const session of sessions) {
        try {
          await this.db.deleteParsingMetricsBySessionId(session.id);
          result.deletedItems.metrics++;
        } catch (error) {
          result.errors.push(`Failed to delete metrics for session ${session.id}: ${error}`);
        }
      }

      // 4. Delete portfolios
      const portfolios = await this.db.getPortfoliosByUserId(userId);
      for (const portfolio of portfolios) {
        try {
          await this.db.deletePortfolio(portfolio.id);
          result.deletedItems.portfolios++;
        } catch (error) {
          result.errors.push(`Failed to delete portfolio ${portfolio.id}: ${error}`);
        }
      }

      // 5. Delete resume sessions
      for (const session of sessions) {
        try {
          await this.db.deleteResumeSession(session.id);
          result.deletedItems.sessions++;
        } catch (error) {
          result.errors.push(`Failed to delete session ${session.id}: ${error}`);
        }
      }

      // 6. Delete user record
      try {
        await this.db.deleteUser(userId);
        result.deletedItems.users = 1;
      } catch (error) {
        result.errors.push(`Failed to delete user ${userId}: ${error}`);
        result.success = false;
      }

      // 7. Delete user consent records
      try {
        await this.deleteUserConsent(userId);
      } catch (error) {
        result.errors.push(`Failed to delete consent for user ${userId}: ${error}`);
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Critical error during deletion: ${error}`);
    }

    return result;
  }

  /**
   * Selective data retention - keep portfolio but delete source files
   * Requirement 7.3: Allow portfolio preservation while removing source files
   */
  async applyRetentionPolicy(
    userId: string,
    policy: DataRetentionPolicy
  ): Promise<DeletionResult> {
    const result: DeletionResult = {
      success: true,
      deletedItems: {
        users: 0,
        sessions: 0,
        portfolios: 0,
        files: 0,
        metrics: 0,
      },
      errors: [],
      completedAt: new Date(),
    };

    try {
      const sessions = await this.db.getResumeSessionsByUserId(userId);

      // Delete source files if requested
      if (policy.deleteSourceFiles) {
        for (const session of sessions) {
          try {
            const fileKey = `users/${userId}/resumes/${session.original_filename}`;
            const fileExists = await this.fileStorage.fileExists(fileKey);
            
            if (fileExists) {
              await this.fileStorage.deleteFile(fileKey);
              result.deletedItems.files++;
            }
          } catch (error) {
            result.errors.push(`Failed to delete file for session ${session.id}: ${error}`);
          }
        }
      }

      // Delete personal data from sessions if requested
      if (policy.deletePersonalData) {
        for (const session of sessions) {
          try {
            // Anonymize parsed data by removing personal information
            await this.db.updateResumeSession(session.id, {
              parsedData: undefined, // Clear parsed data
            });
          } catch (error) {
            result.errors.push(`Failed to anonymize session ${session.id}: ${error}`);
          }
        }
      }

      // Delete metrics if not retained
      if (!policy.retainMetrics) {
        for (const session of sessions) {
          try {
            await this.db.deleteParsingMetricsBySessionId(session.id);
            result.deletedItems.metrics++;
          } catch (error) {
            result.errors.push(`Failed to delete metrics for session ${session.id}: ${error}`);
          }
        }
      }

      // Delete portfolios if not retained
      if (!policy.retainPortfolio) {
        const portfolios = await this.db.getPortfoliosByUserId(userId);
        for (const portfolio of portfolios) {
          try {
            await this.db.deletePortfolio(portfolio.id);
            result.deletedItems.portfolios++;
          } catch (error) {
            result.errors.push(`Failed to delete portfolio ${portfolio.id}: ${error}`);
          }
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Critical error during retention policy application: ${error}`);
    }

    return result;
  }

  /**
   * Schedule data deletion (for 24-hour deletion requirement)
   */
  async scheduleDeletion(userId: string, deletionDate: Date): Promise<void> {
    // Store deletion request in database
    await this.db.createDeletionRequest({
      userId,
      requestedAt: new Date(),
      scheduledFor: deletionDate,
      status: 'pending',
    });
  }

  /**
   * Process pending deletion requests
   */
  async processPendingDeletions(): Promise<DeletionResult[]> {
    const pendingDeletions = await this.db.getPendingDeletionRequests();
    const results: DeletionResult[] = [];

    for (const deletion of pendingDeletions) {
      if (new Date() >= new Date(deletion.scheduledFor)) {
        const result = await this.deleteUserData(deletion.userId);
        results.push(result);

        // Update deletion request status
        await this.db.updateDeletionRequest(deletion.id, {
          status: result.success ? 'completed' : 'failed',
          completedAt: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Get user consent settings
   */
  async getUserConsent(userId: string): Promise<UserConsent | null> {
    return this.db.getUserConsent(userId);
  }

  /**
   * Update user consent settings
   */
  async updateUserConsent(userId: string, consent: Partial<UserConsent>): Promise<void> {
    const existing = await this.getUserConsent(userId);

    if (existing) {
      await this.db.updateUserConsent(userId, {
        ...consent,
        updatedAt: new Date(),
      });
    } else {
      await this.db.createUserConsent({
        userId,
        dataProcessing: consent.dataProcessing ?? true,
        analytics: consent.analytics ?? false,
        marketingEmails: consent.marketingEmails ?? false,
        consentedAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Delete user consent records
   */
  async deleteUserConsent(userId: string): Promise<void> {
    await this.db.deleteUserConsent(userId);
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportUserData(userId: string): Promise<{
    user: any;
    sessions: any[];
    portfolios: any[];
    metrics: any[];
    consent: any;
  }> {
    const user = await this.db.getUserById(userId);
    const sessions = await this.db.getResumeSessionsByUserId(userId);
    const portfolios = await this.db.getPortfoliosByUserId(userId);
    const consent = await this.getUserConsent(userId);

    // Get metrics for all sessions
    const metrics = [];
    for (const session of sessions) {
      const sessionMetrics = await this.db.getParsingMetricsBySessionId(session.id);
      metrics.push(...sessionMetrics);
    }

    return {
      user,
      sessions,
      portfolios,
      metrics,
      consent,
    };
  }

  /**
   * Anonymize old data (for data minimization)
   */
  async anonymizeOldData(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const oldSessions = await this.db.getResumeSessionsOlderThan(cutoffDate);
    let anonymizedCount = 0;

    for (const session of oldSessions) {
      try {
        await this.db.updateResumeSession(session.id, {
          parsedData: undefined,
        });
        anonymizedCount++;
      } catch (error) {
        console.error(`Failed to anonymize session ${session.id}:`, error);
      }
    }

    return anonymizedCount;
  }
}

// Factory function to create service instance
export function createDataRetentionService(env: CloudflareWorkersEnv): DataRetentionService {
  return new DataRetentionService(env);
}
