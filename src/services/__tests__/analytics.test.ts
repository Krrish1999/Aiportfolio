import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from '../analytics';
import { DatabaseService } from '../database';
import { ParsedResumeData } from '@/types';

// Mock CloudflareWorkersEnv
const mockEnv = {
  DB: {
    prepare: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
  },
  RESUME_CACHE: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  RESUME_BUCKET: {},
  JOB_QUEUE: {},
} as any;

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let dbService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    analyticsService = new AnalyticsService(mockEnv);
    dbService = new DatabaseService(mockEnv);
  });

  describe('trackParsingMetrics', () => {
    it('should track parsing metrics for all fields', async () => {
      const sessionId = 'test-session-123';
      const parsedData: ParsedResumeData = {
        profile: {
          name: 'John Doe',
          title: 'Software Engineer',
          email: 'john@example.com',
          phone: '+1234567890',
          location: 'San Francisco, CA',
          links: {
            github: 'https://github.com/johndoe',
            linkedin: 'https://linkedin.com/in/johndoe',
          },
        },
        summary: 'Experienced software engineer',
        experience: [
          {
            company: 'Tech Corp',
            role: 'Senior Engineer',
            startDate: new Date('2020-01-01'),
            bullets: ['Led team', 'Built features'],
            techStack: ['React', 'Node.js'],
            confidence: 0.9,
          },
        ],
        education: [
          {
            degree: 'BS Computer Science',
            institution: 'University',
            startDate: new Date('2015-09-01'),
            endDate: new Date('2019-05-01'),
            confidence: 0.85,
          },
        ],
        skills: [
          {
            category: 'Languages',
            items: ['JavaScript', 'TypeScript'],
            confidence: 0.95,
          },
        ],
        projects: [
          {
            name: 'Cool Project',
            description: 'A cool project',
            techStack: ['React'],
            confidence: 0.8,
          },
        ],
      };

      const confidenceScores = {
        'profile.name': 0.95,
        'profile.title': 0.9,
        'profile.email': 0.98,
        'profile.phone': 0.85,
        'profile.location': 0.8,
        'profile.links.github': 0.92,
        'profile.links.linkedin': 0.93,
        summary: 0.75,
      };

      // Mock batch insert with proper prepare chain
      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
      });
      mockEnv.DB.batch.mockResolvedValue([]);

      const result = await analyticsService.trackParsingMetrics(
        sessionId,
        parsedData,
        confidenceScores
      );

      expect(result.sessionId).toBe(sessionId);
      expect(result.totalFields).toBeGreaterThan(0);
      expect(result.overallConfidence).toBeGreaterThan(0);
      expect(result.fieldMetrics.length).toBeGreaterThan(0);
      expect(mockEnv.DB.batch).toHaveBeenCalled();
    });

    it('should identify low confidence fields', async () => {
      const sessionId = 'test-session-456';
      const parsedData: ParsedResumeData = {
        profile: {
          name: 'Jane Doe',
          title: 'Designer',
          email: 'jane@example.com',
        },
        summary: 'Creative designer',
        experience: [],
        education: [],
        skills: [],
        projects: [],
      };

      const confidenceScores = {
        'profile.name': 0.95,
        'profile.title': 0.6, // Low confidence
        'profile.email': 0.98,
        summary: 0.5, // Low confidence
      };

      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
      });
      mockEnv.DB.batch.mockResolvedValue([]);

      const result = await analyticsService.trackParsingMetrics(
        sessionId,
        parsedData,
        confidenceScores
      );

      expect(result.lowConfidenceFields).toBe(2);
      expect(result.fieldMetrics.some((m) => m.confidenceScore < 0.7)).toBe(true);
    });

    it('should categorize fields correctly', async () => {
      const sessionId = 'test-session-789';
      const parsedData: ParsedResumeData = {
        profile: {
          name: 'Test User',
          email: 'test@example.com',
        },
        summary: 'Test summary',
        experience: [
          {
            company: 'Company',
            role: 'Role',
            startDate: new Date(),
            bullets: [],
            techStack: [],
            confidence: 0.8,
          },
        ],
        education: [],
        skills: [
          {
            category: 'Tech',
            items: ['Skill1'],
            confidence: 0.9,
          },
        ],
        projects: [],
      };

      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
      });
      mockEnv.DB.batch.mockResolvedValue([]);

      const result = await analyticsService.trackParsingMetrics(sessionId, parsedData, {});

      const categories = new Set(result.fieldMetrics.map((m) => m.category));
      expect(categories.has('profile')).toBe(true);
      expect(categories.has('experience')).toBe(true);
      expect(categories.has('skills')).toBe(true);
    });
  });

  describe('trackFieldEdit', () => {
    it('should update existing metric when field is edited', async () => {
      const sessionId = 'test-session-edit';
      const fieldName = 'profile.name';

      const mockMetric = {
        id: 'metric-123',
        session_id: sessionId,
        field_name: fieldName,
        confidence_score: 0.9,
        was_edited: 0,
        created_at: new Date().toISOString(),
      };

      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [mockMetric] }),
          first: vi.fn().mockResolvedValue({ ...mockMetric, was_edited: 1 }),
        }),
      });

      mockEnv.RESUME_CACHE.put.mockResolvedValue(undefined);

      await analyticsService.trackFieldEdit(sessionId, fieldName);

      expect(mockEnv.RESUME_CACHE.put).toHaveBeenCalledWith(
        `edit:${sessionId}:${fieldName}`,
        expect.any(String),
        expect.objectContaining({ expirationTtl: 86400 * 7 })
      );
    });

    it('should create new metric for dynamically added fields', async () => {
      const sessionId = 'test-session-new';
      const fieldName = 'profile.custom_field';

      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue({
            id: 'new-metric',
            session_id: sessionId,
            field_name: fieldName,
            confidence_score: 0.0,
            was_edited: 1,
            created_at: new Date().toISOString(),
          }),
        }),
      });

      mockEnv.RESUME_CACHE.put.mockResolvedValue(undefined);

      await analyticsService.trackFieldEdit(sessionId, fieldName);

      expect(mockEnv.RESUME_CACHE.put).toHaveBeenCalled();
    });
  });

  describe('trackSessionTiming', () => {
    it('should track upload event', async () => {
      const sessionId = 'test-timing-session';
      mockEnv.RESUME_CACHE.put.mockResolvedValue(undefined);

      await analyticsService.trackSessionTiming(sessionId, 'upload');

      expect(mockEnv.RESUME_CACHE.put).toHaveBeenCalledWith(
        `timing:${sessionId}:upload`,
        expect.any(String),
        expect.objectContaining({ expirationTtl: 86400 * 7 })
      );
    });

    it('should track parsing events', async () => {
      const sessionId = 'test-parsing-timing';
      mockEnv.RESUME_CACHE.put.mockResolvedValue(undefined);

      await analyticsService.trackSessionTiming(sessionId, 'parsing_start');
      await analyticsService.trackSessionTiming(sessionId, 'parsing_end');

      expect(mockEnv.RESUME_CACHE.put).toHaveBeenCalledTimes(2);
    });

    it('should track publish event', async () => {
      const sessionId = 'test-publish-timing';
      mockEnv.RESUME_CACHE.put.mockResolvedValue(undefined);

      await analyticsService.trackSessionTiming(sessionId, 'publish');

      expect(mockEnv.RESUME_CACHE.put).toHaveBeenCalledWith(
        `timing:${sessionId}:publish`,
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('getSessionTimeMetrics', () => {
    it('should calculate time durations correctly', async () => {
      const sessionId = 'test-time-calc';
      const uploadTime = '2024-01-01T10:00:00.000Z';
      const firstEditTime = '2024-01-01T10:05:00.000Z';
      const publishTime = '2024-01-01T10:15:00.000Z';

      mockEnv.RESUME_CACHE.get.mockImplementation((key: string) => {
        if (key === `timing:${sessionId}:upload`) return Promise.resolve(uploadTime);
        if (key === `timing:${sessionId}:first_edit`) return Promise.resolve(firstEditTime);
        if (key === `timing:${sessionId}:publish`) return Promise.resolve(publishTime);
        return Promise.resolve(null);
      });

      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      const metrics = await analyticsService.getSessionTimeMetrics(sessionId);

      expect(metrics.uploadTime).toBe(uploadTime);
      expect(metrics.firstEditTime).toBe(firstEditTime);
      expect(metrics.publishTime).toBe(publishTime);
      expect(metrics.timeToFirstEdit).toBe(5 * 60 * 1000); // 5 minutes
      expect(metrics.timeToPublish).toBe(15 * 60 * 1000); // 15 minutes
    });

    it('should handle missing timestamps gracefully', async () => {
      const sessionId = 'test-missing-times';

      mockEnv.RESUME_CACHE.get.mockResolvedValue(null);
      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      const metrics = await analyticsService.getSessionTimeMetrics(sessionId);

      expect(metrics.uploadTime).toBeDefined();
      expect(metrics.timeToFirstEdit).toBeUndefined();
      expect(metrics.timeToPublish).toBeUndefined();
    });
  });

  describe('getSessionAnalytics', () => {
    it('should return complete session analytics', async () => {
      const sessionId = 'test-analytics-session';
      const mockSession = {
        id: sessionId,
        user_id: 'user-123',
        original_filename: 'resume.pdf',
        file_format: 'pdf',
        processing_status: 'completed',
        parsed_data: null,
        created_at: '2024-01-01T10:00:00.000Z',
        updated_at: '2024-01-01T10:05:00.000Z',
      };

      const mockMetrics = [
        {
          id: 'metric-1',
          session_id: sessionId,
          field_name: 'profile.name',
          confidence_score: 0.95,
          was_edited: 0,
          created_at: '2024-01-01T10:01:00.000Z',
        },
        {
          id: 'metric-2',
          session_id: sessionId,
          field_name: 'profile.email',
          confidence_score: 0.6,
          was_edited: 1,
          created_at: '2024-01-01T10:01:00.000Z',
        },
      ];

      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockSession),
          all: vi.fn().mockResolvedValue({ results: mockMetrics }),
        }),
      });

      mockEnv.RESUME_CACHE.get.mockResolvedValue(null);

      const analytics = await analyticsService.getSessionAnalytics(sessionId);

      expect(analytics).toBeDefined();
      expect(analytics?.sessionId).toBe(sessionId);
      expect(analytics?.userId).toBe('user-123');
      expect(analytics?.fileFormat).toBe('pdf');
      expect(analytics?.editCount).toBe(1);
      expect(analytics?.lowConfidenceFieldsCount).toBe(1);
      expect(analytics?.parsingAccuracy).toBeGreaterThan(0);
    });

    it('should return null for non-existent session', async () => {
      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const analytics = await analyticsService.getSessionAnalytics('non-existent');

      expect(analytics).toBeNull();
    });
  });

  describe('getAggregatedMetrics', () => {
    it('should calculate aggregated metrics across sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          user_id: 'user-1',
          file_format: 'pdf',
          created_at: '2024-01-01T10:00:00.000Z',
          original_filename: 'resume1.pdf',
          processing_status: 'completed',
          parsed_data: null,
          updated_at: '2024-01-01T10:05:00.000Z',
        },
        {
          id: 'session-2',
          user_id: 'user-2',
          file_format: 'docx',
          created_at: '2024-01-02T10:00:00.000Z',
          original_filename: 'resume2.docx',
          processing_status: 'completed',
          parsed_data: null,
          updated_at: '2024-01-02T10:05:00.000Z',
        },
      ];

      // Mock the prepare chain for different queries
      let callCount = 0;
      mockEnv.DB.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: get all sessions
          return {
            all: vi.fn().mockResolvedValue({ results: mockSessions }),
          };
        } else {
          // Subsequent calls: session details and metrics
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(mockSessions[callCount % 2]),
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          };
        }
      });

      mockEnv.RESUME_CACHE.get.mockResolvedValue(null);

      const metrics = await analyticsService.getAggregatedMetrics();

      expect(metrics.totalSessions).toBeGreaterThanOrEqual(0);
      expect(metrics.conversionRate).toBeGreaterThanOrEqual(0);
      expect(metrics.averageParsingAccuracy).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty session list', async () => {
      mockEnv.DB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const metrics = await analyticsService.getAggregatedMetrics();

      expect(metrics.totalSessions).toBe(0);
      expect(metrics.publishedSessions).toBe(0);
      expect(metrics.conversionRate).toBe(0);
      expect(metrics.mostEditedFields).toEqual([]);
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics as JSON', async () => {
      const sessionId = 'test-export';
      const mockSession = {
        id: sessionId,
        user_id: 'user-123',
        file_format: 'pdf',
        created_at: '2024-01-01T10:00:00.000Z',
      };

      mockEnv.DB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockSession),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      mockEnv.RESUME_CACHE.get.mockResolvedValue(null);

      const exported = await analyticsService.exportMetrics(sessionId);

      expect(exported).toBeDefined();
      expect(() => JSON.parse(exported)).not.toThrow();
      
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('analytics');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('timeMetrics');
    });
  });

  describe('snapshotMetrics', () => {
    it('should store metrics snapshot in KV', async () => {
      const date = '2024-01-01';
      
      mockEnv.DB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      mockEnv.RESUME_CACHE.put.mockResolvedValue(undefined);

      await analyticsService.snapshotMetrics(date);

      expect(mockEnv.RESUME_CACHE.put).toHaveBeenCalledWith(
        `metrics:snapshot:${date}`,
        expect.any(String),
        expect.objectContaining({ expirationTtl: 86400 * 365 })
      );
    });
  });

  describe('getHistoricalSnapshot', () => {
    it('should retrieve historical metrics snapshot', async () => {
      const date = '2024-01-01';
      const mockSnapshot = {
        totalSessions: 10,
        publishedSessions: 8,
        conversionRate: 80,
        averageParsingAccuracy: 0.85,
      };

      mockEnv.RESUME_CACHE.get.mockResolvedValue(JSON.stringify(mockSnapshot));

      const snapshot = await analyticsService.getHistoricalSnapshot(date);

      expect(snapshot).toEqual(mockSnapshot);
    });

    it('should return null for non-existent snapshot', async () => {
      mockEnv.RESUME_CACHE.get.mockResolvedValue(null);

      const snapshot = await analyticsService.getHistoricalSnapshot('2024-01-01');

      expect(snapshot).toBeNull();
    });
  });
});
