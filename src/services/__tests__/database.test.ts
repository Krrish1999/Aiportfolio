import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService } from '../database';
import { CloudflareWorkersEnv } from '@/config/cloudflare-env';
import { ParsedResumeData } from '@/types';

describe('DatabaseService', () => {
  let env: CloudflareWorkersEnv;
  let dbService: DatabaseService;
  let mockDB: any;
  let mockData: Map<string, any>;

  beforeEach(async () => {
    // Reset mock data store
    mockData = new Map();

    // Mock D1 database operations
    mockDB = {
      prepare: vi.fn((sql: string) => {
        const statement = {
          _sql: sql,
          _params: [] as any[],
        };
        return {
        bind: vi.fn((...params: any[]) => {
          statement._params = params;
          return {
          ...statement,
          first: vi.fn(async () => {
            // Simulate INSERT/UPDATE/SELECT operations
            if (sql.includes('INSERT INTO users')) {
              const user = {
                id: params[0],
                email: params[1],
                created_at: params[2],
                updated_at: params[3],
              };
              mockData.set(`user:${user.id}`, user);
              return user;
            }
            if (sql.includes('SELECT * FROM users WHERE id')) {
              return mockData.get(`user:${params[0]}`) || null;
            }
            if (sql.includes('SELECT * FROM users WHERE email')) {
              for (const [key, value] of mockData.entries()) {
                if (key.startsWith('user:') && value.email === params[0]) {
                  return value;
                }
              }
              return null;
            }
            if (sql.includes('UPDATE users')) {
              const user = mockData.get(`user:${params[2]}`);
              if (!user) return null;
              user.email = params[0];
              user.updated_at = params[1];
              mockData.set(`user:${params[2]}`, user);
              return user;
            }
            if (sql.includes('INSERT INTO resume_sessions')) {
              const session = {
                id: params[0],
                user_id: params[1],
                original_filename: params[2],
                file_format: params[3],
                processing_status: params[4],
                parsed_data: params[5],
                created_at: params[6],
                updated_at: params[7],
              };
              mockData.set(`session:${session.id}`, session);
              return session;
            }
            if (sql.includes('SELECT * FROM resume_sessions WHERE id')) {
              return mockData.get(`session:${params[0]}`) || null;
            }
            if (sql.includes('UPDATE resume_sessions')) {
              const sessionId = params[params.length - 1];
              const session = mockData.get(`session:${sessionId}`);
              if (!session) return null;
              
              let paramIndex = 0;
              if (sql.includes('processing_status = ?')) {
                session.processing_status = params[paramIndex++];
              }
              if (sql.includes('parsed_data = ?')) {
                session.parsed_data = params[paramIndex++];
              }
              session.updated_at = params[paramIndex];
              mockData.set(`session:${sessionId}`, session);
              return session;
            }
            if (sql.includes('INSERT INTO portfolios')) {
              const portfolio = {
                id: params[0],
                user_id: params[1],
                session_id: params[2],
                template_id: params[3],
                customizations: params[4],
                deployment_url: params[5],
                is_published: params[6],
                created_at: params[7],
                updated_at: params[8],
              };
              mockData.set(`portfolio:${portfolio.id}`, portfolio);
              return portfolio;
            }
            if (sql.includes('SELECT * FROM portfolios WHERE id')) {
              return mockData.get(`portfolio:${params[0]}`) || null;
            }
            if (sql.includes('SELECT * FROM portfolios WHERE session_id')) {
              for (const [key, value] of mockData.entries()) {
                if (key.startsWith('portfolio:') && value.session_id === params[0]) {
                  return value;
                }
              }
              return null;
            }
            if (sql.includes('UPDATE portfolios')) {
              const portfolioId = params[params.length - 1];
              const portfolio = mockData.get(`portfolio:${portfolioId}`);
              if (!portfolio) return null;
              
              let paramIndex = 0;
              if (sql.includes('customizations = ?')) {
                portfolio.customizations = params[paramIndex++];
              }
              if (sql.includes('deployment_url = ?')) {
                portfolio.deployment_url = params[paramIndex++];
              }
              if (sql.includes('is_published = ?')) {
                portfolio.is_published = params[paramIndex++];
              }
              portfolio.updated_at = params[paramIndex];
              mockData.set(`portfolio:${portfolioId}`, portfolio);
              return portfolio;
            }
            if (sql.includes('INSERT INTO parsing_metrics')) {
              const metric = {
                id: params[0],
                session_id: params[1],
                field_name: params[2],
                confidence_score: params[3],
                was_edited: params[4],
                created_at: params[5],
              };
              mockData.set(`metric:${metric.id}`, metric);
              return metric;
            }
            if (sql.includes('UPDATE parsing_metrics')) {
              const metric = mockData.get(`metric:${params[1]}`);
              if (!metric) return null;
              metric.was_edited = params[0];
              mockData.set(`metric:${params[1]}`, metric);
              return metric;
            }
            return null;
          }),
          all: vi.fn(async () => {
            const results: any[] = [];
            if (sql.includes('SELECT * FROM resume_sessions WHERE user_id')) {
              for (const [key, value] of mockData.entries()) {
                if (key.startsWith('session:') && value.user_id === params[0]) {
                  results.push(value);
                }
              }
            }
            if (sql.includes('SELECT * FROM portfolios WHERE user_id')) {
              for (const [key, value] of mockData.entries()) {
                if (key.startsWith('portfolio:') && value.user_id === params[0]) {
                  results.push(value);
                }
              }
            }
            if (sql.includes('SELECT * FROM parsing_metrics WHERE session_id')) {
              for (const [key, value] of mockData.entries()) {
                if (key.startsWith('metric:') && value.session_id === params[0]) {
                  results.push(value);
                }
              }
            }
            return { results };
          }),
          run: vi.fn(async () => {
            if (sql.includes('DELETE FROM users WHERE id')) {
              mockData.delete(`user:${params[0]}`);
            }
            if (sql.includes('DELETE FROM resume_sessions WHERE id')) {
              mockData.delete(`session:${params[0]}`);
            }
            if (sql.includes('DELETE FROM portfolios WHERE id')) {
              mockData.delete(`portfolio:${params[0]}`);
            }
            if (sql.includes('DELETE FROM parsing_metrics WHERE id')) {
              mockData.delete(`metric:${params[0]}`);
            }
            return { success: true };
          }),
        };
        }),
      };
      }),
      batch: vi.fn(async (statements: any[]) => {
        // Execute all statements in batch
        // Statements are already bound, so we just need to extract the data
        for (const stmt of statements) {
          // Extract INSERT statement data from the bound statement
          const sql = stmt._sql || '';
          const params = stmt._params || [];
          
          if (sql.includes('INSERT INTO parsing_metrics')) {
            const metric = {
              id: params[0],
              session_id: params[1],
              field_name: params[2],
              confidence_score: params[3],
              was_edited: params[4],
              created_at: params[5],
            };
            mockData.set(`metric:${metric.id}`, metric);
          }
        }
        return [];
      }),
      exec: vi.fn(async (sql: string) => {
        // Handle transactions
        if (sql.includes('BEGIN TRANSACTION') && sql.includes('COMMIT')) {
          // Extract and execute SQL statements - join all lines first
          const fullSql = sql.replace(/\n/g, ' ').replace(/\s+/g, ' ');
          
          // Extract INSERT INTO resume_sessions
          const sessionMatch = fullSql.match(/INSERT INTO resume_sessions[^V]+VALUES \('([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', (NULL|'(?:[^']|'')*'), '([^']+)', '([^']+)'\)/);
          if (sessionMatch) {
            const session = {
              id: sessionMatch[1],
              user_id: sessionMatch[2],
              original_filename: sessionMatch[3],
              file_format: sessionMatch[4],
              processing_status: sessionMatch[5],
              parsed_data: sessionMatch[6] === 'NULL' ? null : sessionMatch[6].replace(/^'|'$/g, '').replace(/''/g, "'"),
              created_at: sessionMatch[7],
              updated_at: sessionMatch[8],
            };
            mockData.set(`session:${session.id}`, session);
          }
          
          // Extract INSERT INTO portfolios
          const portfolioMatch = fullSql.match(/INSERT INTO portfolios[^V]+VALUES \('([^']+)', '([^']+)', '([^']+)', '([^']+)', (NULL|'(?:[^']|'')*'), (NULL|'[^']*'), (\d+), '([^']+)', '([^']+)'\)/);
          if (portfolioMatch) {
            const portfolio = {
              id: portfolioMatch[1],
              user_id: portfolioMatch[2],
              session_id: portfolioMatch[3],
              template_id: portfolioMatch[4],
              customizations: portfolioMatch[5] === 'NULL' ? null : portfolioMatch[5].replace(/^'|'$/g, '').replace(/''/g, "'"),
              deployment_url: portfolioMatch[6] === 'NULL' ? null : portfolioMatch[6].replace(/^'|'$/g, ''),
              is_published: parseInt(portfolioMatch[7]),
              created_at: portfolioMatch[8],
              updated_at: portfolioMatch[9],
            };
            mockData.set(`portfolio:${portfolio.id}`, portfolio);
          }
          
          // Handle DELETE statements
          if (fullSql.includes('DELETE FROM users WHERE id')) {
            const match = fullSql.match(/DELETE FROM users WHERE id = '([^']+)'/);
            if (match) {
              const userId = match[1];
              mockData.delete(`user:${userId}`);
              // Cascade delete sessions, portfolios, and metrics
              for (const [key, value] of Array.from(mockData.entries())) {
                if (key.startsWith('session:') && value.user_id === userId) {
                  const sessionId = value.id;
                  mockData.delete(key);
                  // Also delete metrics for this session
                  for (const [metricKey, metricValue] of Array.from(mockData.entries())) {
                    if (metricKey.startsWith('metric:') && metricValue.session_id === sessionId) {
                      mockData.delete(metricKey);
                    }
                  }
                }
                if (key.startsWith('portfolio:') && value.user_id === userId) {
                  mockData.delete(key);
                }
              }
            }
          }
        }
        return { success: true };
      }),
    };

    // Mock Cloudflare Workers environment
    env = {
      RESUME_BUCKET: {} as any,
      RESUME_CACHE: {} as any,
      DB: mockDB as any,
      JOB_QUEUE: {} as any,
      CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    };

    dbService = new DatabaseService(env);
  });

  describe('User Operations', () => {
    it('should create a user', async () => {
      const user = await dbService.createUser({ email: 'test@example.com' });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.created_at).toBeDefined();
      expect(user.updated_at).toBeDefined();
    });

    it('should get a user by id', async () => {
      const created = await dbService.createUser({ email: 'test@example.com' });
      const user = await dbService.getUser(created.id);

      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
    });

    it('should get a user by email', async () => {
      await dbService.createUser({ email: 'test@example.com' });
      const user = await dbService.getUserByEmail('test@example.com');

      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
    });

    it('should update a user', async () => {
      const created = await dbService.createUser({ email: 'test@example.com' });
      const updated = await dbService.updateUser(created.id, 'updated@example.com');

      expect(updated.email).toBe('updated@example.com');
    });

    it('should delete a user', async () => {
      const created = await dbService.createUser({ email: 'test@example.com' });
      await dbService.deleteUser(created.id);
      const user = await dbService.getUser(created.id);

      expect(user).toBeNull();
    });
  });

  describe('Resume Session Operations', () => {
    let userId: string;

    beforeEach(async () => {
      const user = await dbService.createUser({ email: 'test@example.com' });
      userId = user.id;
    });

    it('should create a resume session', async () => {
      const session = await dbService.createResumeSession({
        userId,
        originalFilename: 'resume.pdf',
        fileFormat: 'pdf',
        processingStatus: 'pending',
      });

      expect(session.id).toBeDefined();
      expect(session.user_id).toBe(userId);
      expect(session.original_filename).toBe('resume.pdf');
      expect(session.processing_status).toBe('pending');
    });

    it('should create a resume session with parsed data', async () => {
      const parsedData: ParsedResumeData = {
        profile: {
          name: 'John Doe',
          title: 'Software Engineer',
          email: 'john@example.com',
          links: {},
        },
        summary: 'Experienced developer',
        skills: [],
        experience: [],
        projects: [],
        education: [],
      };

      const session = await dbService.createResumeSession({
        userId,
        originalFilename: 'resume.pdf',
        fileFormat: 'pdf',
        processingStatus: 'complete',
        parsedData,
      });

      expect(session.parsed_data).toBeDefined();
      const retrieved = dbService.getParsedData(session);
      expect(retrieved?.profile.name).toBe('John Doe');
    });

    it('should get resume sessions by user id', async () => {
      await dbService.createResumeSession({
        userId,
        originalFilename: 'resume1.pdf',
        fileFormat: 'pdf',
        processingStatus: 'pending',
      });

      await dbService.createResumeSession({
        userId,
        originalFilename: 'resume2.pdf',
        fileFormat: 'pdf',
        processingStatus: 'complete',
      });

      const sessions = await dbService.getResumeSessionsByUserId(userId);
      expect(sessions).toHaveLength(2);
    });

    it('should update a resume session', async () => {
      const session = await dbService.createResumeSession({
        userId,
        originalFilename: 'resume.pdf',
        fileFormat: 'pdf',
        processingStatus: 'pending',
      });

      const updated = await dbService.updateResumeSession(session.id, {
        processingStatus: 'complete',
      });

      expect(updated.processing_status).toBe('complete');
    });
  });

  describe('Portfolio Operations', () => {
    let userId: string;
    let sessionId: string;

    beforeEach(async () => {
      const user = await dbService.createUser({ email: 'test@example.com' });
      userId = user.id;

      const session = await dbService.createResumeSession({
        userId,
        originalFilename: 'resume.pdf',
        fileFormat: 'pdf',
        processingStatus: 'complete',
      });
      sessionId = session.id;
    });

    it('should create a portfolio', async () => {
      const portfolio = await dbService.createPortfolio({
        userId,
        sessionId,
        templateId: 'modern',
      });

      expect(portfolio.id).toBeDefined();
      expect(portfolio.user_id).toBe(userId);
      expect(portfolio.session_id).toBe(sessionId);
      expect(portfolio.template_id).toBe('modern');
      expect(portfolio.is_published).toBe(0);
    });

    it('should create a portfolio with customizations', async () => {
      const customizations = {
        primaryColor: '#3b82f6',
        font: 'Inter',
      };

      const portfolio = await dbService.createPortfolio({
        userId,
        sessionId,
        templateId: 'modern',
        customizations,
        isPublished: true,
      });

      expect(portfolio.customizations).toBeDefined();
      expect(portfolio.is_published).toBe(1);
      expect(dbService.isPortfolioPublished(portfolio)).toBe(true);

      const retrieved = dbService.getCustomizations(portfolio);
      expect(retrieved?.primaryColor).toBe('#3b82f6');
    });

    it('should get portfolios by user id', async () => {
      await dbService.createPortfolio({
        userId,
        sessionId,
        templateId: 'modern',
      });

      const portfolios = await dbService.getPortfoliosByUserId(userId);
      expect(portfolios).toHaveLength(1);
    });

    it('should update a portfolio', async () => {
      const portfolio = await dbService.createPortfolio({
        userId,
        sessionId,
        templateId: 'modern',
      });

      const updated = await dbService.updatePortfolio(portfolio.id, {
        deploymentUrl: 'https://example.pages.dev',
        isPublished: true,
      });

      expect(updated.deployment_url).toBe('https://example.pages.dev');
      expect(updated.is_published).toBe(1);
    });
  });

  describe('Parsing Metric Operations', () => {
    let sessionId: string;

    beforeEach(async () => {
      const user = await dbService.createUser({ email: 'test@example.com' });
      const session = await dbService.createResumeSession({
        userId: user.id,
        originalFilename: 'resume.pdf',
        fileFormat: 'pdf',
        processingStatus: 'complete',
      });
      sessionId = session.id;
    });

    it('should create a parsing metric', async () => {
      const metric = await dbService.createParsingMetric({
        sessionId,
        fieldName: 'profile.name',
        confidenceScore: 0.95,
      });

      expect(metric.id).toBeDefined();
      expect(metric.session_id).toBe(sessionId);
      expect(metric.field_name).toBe('profile.name');
      expect(metric.confidence_score).toBe(0.95);
      expect(metric.was_edited).toBe(0);
    });

    it('should batch create parsing metrics', async () => {
      await dbService.batchCreateParsingMetrics([
        { sessionId, fieldName: 'profile.name', confidenceScore: 0.95 },
        { sessionId, fieldName: 'profile.email', confidenceScore: 0.98 },
        { sessionId, fieldName: 'summary', confidenceScore: 0.85 },
      ]);

      const metrics = await dbService.getParsingMetricsBySessionId(sessionId);
      expect(metrics).toHaveLength(3);
    });

    it('should update a parsing metric', async () => {
      const metric = await dbService.createParsingMetric({
        sessionId,
        fieldName: 'profile.name',
        confidenceScore: 0.95,
      });

      const updated = await dbService.updateParsingMetric(metric.id, true);
      expect(updated.was_edited).toBe(1);
      expect(dbService.wasMetricEdited(updated)).toBe(true);
    });
  });

  describe('Transaction Operations', () => {
    let userId: string;

    beforeEach(async () => {
      const user = await dbService.createUser({ email: 'test@example.com' });
      userId = user.id;
    });

    it('should create portfolio with session in a transaction', async () => {
      const result = await dbService.createPortfolioWithSession(
        {
          userId,
          originalFilename: 'resume.pdf',
          fileFormat: 'pdf',
          processingStatus: 'complete',
        },
        {
          userId,
          templateId: 'modern',
        }
      );

      expect(result.session).toBeDefined();
      expect(result.portfolio).toBeDefined();
      expect(result.portfolio.session_id).toBe(result.session.id);
    });

    it('should delete user with all related data', async () => {
      const session = await dbService.createResumeSession({
        userId,
        originalFilename: 'resume.pdf',
        fileFormat: 'pdf',
        processingStatus: 'complete',
      });

      await dbService.createPortfolio({
        userId,
        sessionId: session.id,
        templateId: 'modern',
      });

      await dbService.createParsingMetric({
        sessionId: session.id,
        fieldName: 'profile.name',
        confidenceScore: 0.95,
      });

      await dbService.deleteUserWithRelatedData(userId);

      const user = await dbService.getUser(userId);
      expect(user).toBeNull();

      const sessions = await dbService.getResumeSessionsByUserId(userId);
      expect(sessions).toHaveLength(0);
    });
  });
});
