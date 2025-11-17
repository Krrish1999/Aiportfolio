import { CloudflareWorkersEnv } from '@/config/cloudflare-env';
import { ParsedResumeData } from '@/types';
import { withRetry, CloudflareErrorHandler } from '@/utils/errors';

// Database model types matching D1 schema
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeSession {
  id: string;
  user_id: string;
  original_filename: string;
  file_format: string;
  processing_status: string;
  parsed_data: string | null;
  created_at: string;
  updated_at: string;
}

export interface Portfolio {
  id: string;
  user_id: string;
  session_id: string;
  template_id: string;
  customizations: string | null;
  deployment_url: string | null;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export interface ParsingMetric {
  id: string;
  session_id: string;
  field_name: string;
  confidence_score: number;
  was_edited: number;
  created_at: string;
}

// Input types for creating records
export interface CreateUserInput {
  email: string;
}

export interface CreateResumeSessionInput {
  userId: string;
  originalFilename: string;
  fileFormat: string;
  processingStatus: string;
  parsedData?: ParsedResumeData;
}

export interface UpdateResumeSessionInput {
  processingStatus?: string;
  parsedData?: ParsedResumeData;
}

export interface CreatePortfolioInput {
  userId: string;
  sessionId: string;
  templateId: string;
  customizations?: Record<string, any>;
  deploymentUrl?: string;
  isPublished?: boolean;
}

export interface UpdatePortfolioInput {
  customizations?: Record<string, any>;
  deploymentUrl?: string;
  isPublished?: boolean;
}

export interface CreateParsingMetricInput {
  sessionId: string;
  fieldName: string;
  confidenceScore: number;
  wasEdited?: boolean;
}

/**
 * DatabaseService for D1 operations
 * Provides CRUD operations for all database models with proper type conversions
 */
export class DatabaseService {
  constructor(private env: CloudflareWorkersEnv) {}

  // ============================================================================
  // User Operations
  // ============================================================================

  async createUser(input: CreateUserInput): Promise<User> {
    return withRetry(
      async () => {
        try {
          const id = crypto.randomUUID();
          const now = new Date().toISOString();

          const result = await this.env.DB.prepare(
            'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING *'
          )
            .bind(id, input.email, now, now)
            .first<User>();

          if (!result) {
            throw new Error('Failed to create user');
          }

          return result;
        } catch (error: any) {
          CloudflareErrorHandler.handleD1Error(error);
        }
      },
      3,
      1000,
      'D1'
    );
  }

  async getUser(id: string): Promise<User | null> {
    return withRetry(
      async () => {
        try {
          const result = await this.env.DB.prepare('SELECT * FROM users WHERE id = ?')
            .bind(id)
            .first<User>();

          return result;
        } catch (error: any) {
          CloudflareErrorHandler.handleD1Error(error);
        }
      },
      2,
      1000,
      'D1'
    );
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<User>();

    return result;
  }

  async updateUser(id: string, email: string): Promise<User> {
    const now = new Date().toISOString();

    const result = await this.env.DB.prepare(
      'UPDATE users SET email = ?, updated_at = ? WHERE id = ? RETURNING *'
    )
      .bind(email, now, id)
      .first<User>();

    if (!result) {
      throw new Error('User not found');
    }

    return result;
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await this.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first();

    return result as User | null;
  }

  async deleteUser(id: string): Promise<void> {
    await this.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  }

  // ============================================================================
  // Resume Session Operations
  // ============================================================================

  async createResumeSession(input: CreateResumeSessionInput): Promise<ResumeSession> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const parsedDataJson = input.parsedData ? JSON.stringify(input.parsedData) : null;

    const result = await this.env.DB.prepare(
      `INSERT INTO resume_sessions 
       (id, user_id, original_filename, file_format, processing_status, parsed_data, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
       RETURNING *`
    )
      .bind(
        id,
        input.userId,
        input.originalFilename,
        input.fileFormat,
        input.processingStatus,
        parsedDataJson,
        now,
        now
      )
      .first<ResumeSession>();

    if (!result) {
      throw new Error('Failed to create resume session');
    }

    return result;
  }

  async getResumeSession(id: string): Promise<ResumeSession | null> {
    const result = await this.env.DB.prepare('SELECT * FROM resume_sessions WHERE id = ?')
      .bind(id)
      .first<ResumeSession>();

    return result;
  }

  async getResumeSessionsByUserId(userId: string): Promise<ResumeSession[]> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM resume_sessions WHERE user_id = ? ORDER BY created_at DESC'
    )
      .bind(userId)
      .all<ResumeSession>();

    return result.results || [];
  }

  async updateResumeSession(id: string, input: UpdateResumeSessionInput): Promise<ResumeSession> {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const bindings: any[] = [];

    if (input.processingStatus !== undefined) {
      updates.push('processing_status = ?');
      bindings.push(input.processingStatus);
    }

    if (input.parsedData !== undefined) {
      updates.push('parsed_data = ?');
      bindings.push(JSON.stringify(input.parsedData));
    }

    updates.push('updated_at = ?');
    bindings.push(now);
    bindings.push(id);

    const result = await this.env.DB.prepare(
      `UPDATE resume_sessions SET ${updates.join(', ')} WHERE id = ? RETURNING *`
    )
      .bind(...bindings)
      .first<ResumeSession>();

    if (!result) {
      throw new Error('Resume session not found');
    }

    return result;
  }

  async deleteResumeSession(id: string): Promise<void> {
    await this.env.DB.prepare('DELETE FROM resume_sessions WHERE id = ?').bind(id).run();
  }

  /**
   * Parse JSON data from resume session
   */
  getParsedData(session: ResumeSession): ParsedResumeData | null {
    if (!session.parsed_data) return null;
    try {
      return JSON.parse(session.parsed_data) as ParsedResumeData;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Portfolio Operations
  // ============================================================================

  async createPortfolio(input: CreatePortfolioInput): Promise<Portfolio> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const customizationsJson = input.customizations ? JSON.stringify(input.customizations) : null;
    const isPublished = input.isPublished ? 1 : 0;

    const result = await this.env.DB.prepare(
      `INSERT INTO portfolios 
       (id, user_id, session_id, template_id, customizations, deployment_url, is_published, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
       RETURNING *`
    )
      .bind(
        id,
        input.userId,
        input.sessionId,
        input.templateId,
        customizationsJson,
        input.deploymentUrl || null,
        isPublished,
        now,
        now
      )
      .first<Portfolio>();

    if (!result) {
      throw new Error('Failed to create portfolio');
    }

    return result;
  }

  async getPortfolio(id: string): Promise<Portfolio | null> {
    const result = await this.env.DB.prepare('SELECT * FROM portfolios WHERE id = ?')
      .bind(id)
      .first<Portfolio>();

    return result;
  }

  async getPortfoliosByUserId(userId: string): Promise<Portfolio[]> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at DESC'
    )
      .bind(userId)
      .all<Portfolio>();

    return result.results || [];
  }

  async getPortfolioBySessionId(sessionId: string): Promise<Portfolio | null> {
    const result = await this.env.DB.prepare('SELECT * FROM portfolios WHERE session_id = ?')
      .bind(sessionId)
      .first<Portfolio>();

    return result;
  }

  async updatePortfolio(id: string, input: UpdatePortfolioInput): Promise<Portfolio> {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const bindings: any[] = [];

    if (input.customizations !== undefined) {
      updates.push('customizations = ?');
      bindings.push(JSON.stringify(input.customizations));
    }

    if (input.deploymentUrl !== undefined) {
      updates.push('deployment_url = ?');
      bindings.push(input.deploymentUrl);
    }

    if (input.isPublished !== undefined) {
      updates.push('is_published = ?');
      bindings.push(input.isPublished ? 1 : 0);
    }

    updates.push('updated_at = ?');
    bindings.push(now);
    bindings.push(id);

    const result = await this.env.DB.prepare(
      `UPDATE portfolios SET ${updates.join(', ')} WHERE id = ? RETURNING *`
    )
      .bind(...bindings)
      .first<Portfolio>();

    if (!result) {
      throw new Error('Portfolio not found');
    }

    return result;
  }

  async deletePortfolio(id: string): Promise<void> {
    await this.env.DB.prepare('DELETE FROM portfolios WHERE id = ?').bind(id).run();
  }

  /**
   * Parse JSON customizations from portfolio
   */
  getCustomizations(portfolio: Portfolio): Record<string, any> | null {
    if (!portfolio.customizations) return null;
    try {
      return JSON.parse(portfolio.customizations);
    } catch {
      return null;
    }
  }

  /**
   * Check if portfolio is published (convert Int to Boolean)
   */
  isPortfolioPublished(portfolio: Portfolio): boolean {
    return portfolio.is_published === 1;
  }

  // ============================================================================
  // Parsing Metric Operations
  // ============================================================================

  async createParsingMetric(input: CreateParsingMetricInput): Promise<ParsingMetric> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const wasEdited = input.wasEdited ? 1 : 0;

    const result = await this.env.DB.prepare(
      `INSERT INTO parsing_metrics 
       (id, session_id, field_name, confidence_score, was_edited, created_at) 
       VALUES (?, ?, ?, ?, ?, ?) 
       RETURNING *`
    )
      .bind(id, input.sessionId, input.fieldName, input.confidenceScore, wasEdited, now)
      .first<ParsingMetric>();

    if (!result) {
      throw new Error('Failed to create parsing metric');
    }

    return result;
  }

  async getParsingMetricsBySessionId(sessionId: string): Promise<ParsingMetric[]> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM parsing_metrics WHERE session_id = ? ORDER BY created_at DESC'
    )
      .bind(sessionId)
      .all<ParsingMetric>();

    return result.results || [];
  }

  async updateParsingMetric(id: string, wasEdited: boolean): Promise<ParsingMetric> {
    const result = await this.env.DB.prepare(
      'UPDATE parsing_metrics SET was_edited = ? WHERE id = ? RETURNING *'
    )
      .bind(wasEdited ? 1 : 0, id)
      .first<ParsingMetric>();

    if (!result) {
      throw new Error('Parsing metric not found');
    }

    return result;
  }

  async deleteParsingMetric(id: string): Promise<void> {
    await this.env.DB.prepare('DELETE FROM parsing_metrics WHERE id = ?').bind(id).run();
  }

  /**
   * Check if metric was edited (convert Int to Boolean)
   */
  wasMetricEdited(metric: ParsingMetric): boolean {
    return metric.was_edited === 1;
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Batch insert parsing metrics for better performance
   */
  async batchCreateParsingMetrics(inputs: CreateParsingMetricInput[]): Promise<void> {
    const statements = inputs.map((input) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const wasEdited = input.wasEdited ? 1 : 0;

      return this.env.DB.prepare(
        `INSERT INTO parsing_metrics 
         (id, session_id, field_name, confidence_score, was_edited, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, input.sessionId, input.fieldName, input.confidenceScore, wasEdited, now);
    });

    await this.env.DB.batch(statements);
  }

  // ============================================================================
  // Transaction Support
  // ============================================================================

  /**
   * Create portfolio with session in a transaction
   */
  async createPortfolioWithSession(
    sessionInput: CreateResumeSessionInput,
    portfolioInput: Omit<CreatePortfolioInput, 'sessionId'>
  ): Promise<{ session: ResumeSession; portfolio: Portfolio }> {
    const sessionId = crypto.randomUUID();
    const portfolioId = crypto.randomUUID();
    const now = new Date().toISOString();
    const parsedDataJson = sessionInput.parsedData ? JSON.stringify(sessionInput.parsedData) : null;
    const customizationsJson = portfolioInput.customizations
      ? JSON.stringify(portfolioInput.customizations)
      : null;
    const isPublished = portfolioInput.isPublished ? 1 : 0;

    // Execute transaction
    await this.env.DB.exec(`
      BEGIN TRANSACTION;
      INSERT INTO resume_sessions 
        (id, user_id, original_filename, file_format, processing_status, parsed_data, created_at, updated_at) 
        VALUES ('${sessionId}', '${sessionInput.userId}', '${sessionInput.originalFilename}', '${sessionInput.fileFormat}', '${sessionInput.processingStatus}', ${parsedDataJson ? `'${parsedDataJson.replace(/'/g, "''")}'` : 'NULL'}, '${now}', '${now}');
      INSERT INTO portfolios 
        (id, user_id, session_id, template_id, customizations, deployment_url, is_published, created_at, updated_at) 
        VALUES ('${portfolioId}', '${portfolioInput.userId}', '${sessionId}', '${portfolioInput.templateId}', ${customizationsJson ? `'${customizationsJson.replace(/'/g, "''")}'` : 'NULL'}, ${portfolioInput.deploymentUrl ? `'${portfolioInput.deploymentUrl}'` : 'NULL'}, ${isPublished}, '${now}', '${now}');
      COMMIT;
    `);

    // Fetch the created records
    const session = await this.getResumeSession(sessionId);
    const portfolio = await this.getPortfolio(portfolioId);

    if (!session || !portfolio) {
      throw new Error('Failed to create portfolio with session');
    }

    return { session, portfolio };
  }

  /**
   * Delete user and all related data in a transaction
   */
  async deleteUserWithRelatedData(userId: string): Promise<void> {
    await this.env.DB.exec(`
      BEGIN TRANSACTION;
      DELETE FROM parsing_metrics WHERE session_id IN (SELECT id FROM resume_sessions WHERE user_id = '${userId}');
      DELETE FROM portfolios WHERE user_id = '${userId}';
      DELETE FROM resume_sessions WHERE user_id = '${userId}';
      DELETE FROM users WHERE id = '${userId}';
      COMMIT;
    `);
  }

  /**
   * Delete parsing metrics by session ID
   */
  async deleteParsingMetricsBySessionId(sessionId: string): Promise<void> {
    await this.env.DB.prepare('DELETE FROM parsing_metrics WHERE session_id = ?')
      .bind(sessionId)
      .run();
  }

  /**
   * Get resume sessions older than a specific date
   */
  async getResumeSessionsOlderThan(date: Date): Promise<ResumeSession[]> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM resume_sessions WHERE created_at < ?'
    )
      .bind(date.toISOString())
      .all();

    return result.results as ResumeSession[];
  }

  /**
   * User consent management
   */
  async getUserConsent(userId: string): Promise<any> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM user_consent WHERE user_id = ?'
    )
      .bind(userId)
      .first();

    return result;
  }

  async createUserConsent(consent: any): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO user_consent (user_id, data_processing, analytics, marketing_emails, consented_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        consent.userId,
        consent.dataProcessing ? 1 : 0,
        consent.analytics ? 1 : 0,
        consent.marketingEmails ? 1 : 0,
        consent.consentedAt.toISOString(),
        consent.updatedAt.toISOString()
      )
      .run();
  }

  async updateUserConsent(userId: string, consent: any): Promise<void> {
    const updates: string[] = [];
    const bindings: any[] = [];

    if (consent.dataProcessing !== undefined) {
      updates.push('data_processing = ?');
      bindings.push(consent.dataProcessing ? 1 : 0);
    }
    if (consent.analytics !== undefined) {
      updates.push('analytics = ?');
      bindings.push(consent.analytics ? 1 : 0);
    }
    if (consent.marketingEmails !== undefined) {
      updates.push('marketing_emails = ?');
      bindings.push(consent.marketingEmails ? 1 : 0);
    }
    if (consent.updatedAt) {
      updates.push('updated_at = ?');
      bindings.push(consent.updatedAt.toISOString());
    }

    if (updates.length > 0) {
      bindings.push(userId);
      await this.env.DB.prepare(
        `UPDATE user_consent SET ${updates.join(', ')} WHERE user_id = ?`
      )
        .bind(...bindings)
        .run();
    }
  }

  async deleteUserConsent(userId: string): Promise<void> {
    await this.env.DB.prepare('DELETE FROM user_consent WHERE user_id = ?')
      .bind(userId)
      .run();
  }

  /**
   * Deletion request management
   */
  async createDeletionRequest(request: any): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO deletion_requests (id, user_id, requested_at, scheduled_for, status)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        request.userId,
        request.requestedAt.toISOString(),
        request.scheduledFor.toISOString(),
        request.status
      )
      .run();
  }

  async getPendingDeletionRequests(): Promise<any[]> {
    const result = await this.env.DB.prepare(
      "SELECT * FROM deletion_requests WHERE status = 'pending'"
    ).all();

    return result.results || [];
  }

  async updateDeletionRequest(id: string, update: any): Promise<void> {
    const updates: string[] = [];
    const bindings: any[] = [];

    if (update.status) {
      updates.push('status = ?');
      bindings.push(update.status);
    }
    if (update.completedAt) {
      updates.push('completed_at = ?');
      bindings.push(update.completedAt.toISOString());
    }

    if (updates.length > 0) {
      bindings.push(id);
      await this.env.DB.prepare(
        `UPDATE deletion_requests SET ${updates.join(', ')} WHERE id = ?`
      )
        .bind(...bindings)
        .run();
    }
  }
}
