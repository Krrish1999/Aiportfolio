import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock services
vi.mock('@/services/deployment', () => ({
  DeploymentService: vi.fn().mockImplementation(() => ({
    deploy: vi.fn(),
    setupCustomDomain: vi.fn(),
  })),
}));

vi.mock('@/services/static-site-generator', () => ({
  StaticSiteGenerator: vi.fn().mockImplementation(() => ({
    generateSite: vi.fn(),
    generateSitemap: vi.fn(),
    generateRobotsTxt: vi.fn(),
  })),
}));

vi.mock('@/config/database', () => ({
  createDatabaseService: vi.fn(() => ({
    createPortfolio: vi.fn(),
  })),
}));

// Import after mocks
import { POST, GET } from '../route';
import { DeploymentService } from '@/services/deployment';
import { StaticSiteGenerator } from '@/services/static-site-generator';

describe('/api/deploy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
    process.env.CLOUDFLARE_API_TOKEN = 'test-api-token';
  });

  describe('POST', () => {
    it('should deploy portfolio successfully', async () => {
      const mockEnv = {
        DB: {} as any,
        RESUME_BUCKET: {} as any,
        RESUME_CACHE: {} as any,
        JOB_QUEUE: {} as any,
      };

      const mockBody = {
        sessionId: 'test-session-id',
        resumeData: {
          profile: { name: 'John Doe', title: 'Developer', email: 'john@example.com', phone: '', location: '', links: {} },
          summary: 'Test summary',
          skills: [],
          experience: [],
          projects: [],
          education: [],
        },
        template: { id: 'modern', name: 'Modern', sections: [] },
        customizations: {},
        seoConfig: { title: 'John Doe', description: 'Portfolio', keywords: [] },
      };

      const mockSite = {
        html: '<html></html>',
        css: 'body {}',
        metadata: { title: 'John Doe', description: 'Portfolio', keywords: [] },
      };

      const mockDeploymentResult = {
        success: true,
        url: 'https://test-session-id.pages.dev',
        deploymentId: 'deploy-123',
        platform: 'cloudflare-pages',
      };

      vi.mocked(StaticSiteGenerator).mockImplementation(() => ({
        generateSite: vi.fn().mockReturnValue(mockSite),
        generateSitemap: vi.fn().mockReturnValue('<sitemap></sitemap>'),
        generateRobotsTxt: vi.fn().mockReturnValue('User-agent: *'),
      } as any));

      vi.mocked(DeploymentService).mockImplementation(() => ({
        deploy: vi.fn().mockResolvedValue(mockDeploymentResult),
        setupCustomDomain: vi.fn(),
      } as any));

      const request = new NextRequest('http://localhost:3000/api/deploy', {
        method: 'POST',
        body: JSON.stringify(mockBody),
      });
      (request as any).env = mockEnv;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.url).toBe('https://test-session-id.pages.dev');
      expect(data.data.platform).toBe('cloudflare-pages');
    });

    it('should return error when required fields are missing', async () => {
      const mockEnv = {
        DB: {} as any,
        RESUME_BUCKET: {} as any,
        RESUME_CACHE: {} as any,
        JOB_QUEUE: {} as any,
      };

      const request = new NextRequest('http://localhost:3000/api/deploy', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      (request as any).env = mockEnv;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET', () => {
    it('should return method not allowed', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toContain('Method not allowed');
    });
  });
});
