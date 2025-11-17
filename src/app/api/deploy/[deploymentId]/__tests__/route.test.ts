import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock services
vi.mock('@/services/deployment', () => ({
  DeploymentService: vi.fn().mockImplementation(() => ({
    getDeploymentStatus: vi.fn(),
    deleteDeployment: vi.fn(),
  })),
}));

// Import after mocks
import { GET, DELETE } from '../route';
import { DeploymentService } from '@/services/deployment';

describe('/api/deploy/[deploymentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
    process.env.CLOUDFLARE_API_TOKEN = 'test-api-token';
  });

  describe('GET', () => {
    it('should get deployment status successfully', async () => {
      const mockStatus = {
        deploymentId: 'deploy-123',
        status: 'ready' as const,
        progress: 100,
        message: 'Deployment complete',
        url: 'https://test.pages.dev',
      };

      vi.mocked(DeploymentService).mockImplementation(() => ({
        getDeploymentStatus: vi.fn().mockReturnValue(mockStatus),
      } as any));

      const request = new NextRequest('http://localhost:3000/api/deploy/deploy-123');
      const response = await GET(request, { params: { deploymentId: 'deploy-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deploymentId).toBe('deploy-123');
      expect(data.data.status).toBe('ready');
      expect(data.data.url).toBe('https://test.pages.dev');
    });

    it('should return error when deployment not found', async () => {
      vi.mocked(DeploymentService).mockImplementation(() => ({
        getDeploymentStatus: vi.fn().mockReturnValue(null),
      } as any));

      const request = new NextRequest('http://localhost:3000/api/deploy/invalid-id');
      const response = await GET(request, { params: { deploymentId: 'invalid-id' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE', () => {
    it('should delete deployment successfully', async () => {
      vi.mocked(DeploymentService).mockImplementation(() => ({
        deleteDeployment: vi.fn().mockResolvedValue(true),
      } as any));

      const request = new NextRequest('http://localhost:3000/api/deploy/deploy-123', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: { deploymentId: 'deploy-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deploymentId).toBe('deploy-123');
    });

    it('should return error when deployment not found', async () => {
      vi.mocked(DeploymentService).mockImplementation(() => ({
        deleteDeployment: vi.fn().mockResolvedValue(false),
      } as any));

      const request = new NextRequest('http://localhost:3000/api/deploy/invalid-id', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: { deploymentId: 'invalid-id' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });
});
