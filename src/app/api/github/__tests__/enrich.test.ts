import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../enrich/route';
import { NextRequest } from 'next/server';

// Mock the github integration service
vi.mock('@/services/github-integration', () => ({
  githubIntegrationService: {
    enrichResumeData: vi.fn(async () => ({
      username: 'testuser',
      repositories: [
        {
          name: 'awesome-project',
          description: 'An awesome project',
          url: 'https://github.com/testuser/awesome-project',
          language: 'TypeScript',
          stars: 150,
          forks: 25,
          topics: ['react', 'nextjs'],
        },
      ],
    })),
  },
}));

describe('GET /api/github/enrich', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return enriched GitHub data for authenticated user', async () => {
    const request = new NextRequest('http://localhost:3000/api/github/enrich');
    
    Object.defineProperty(request, 'cookies', {
      value: {
        get: (name: string) => {
          if (name === 'github_access_token') return { value: 'mock_token' };
          if (name === 'github_username') return { value: 'testuser' };
          return undefined;
        },
      },
    });
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.username).toBe('testuser');
    expect(data.repositories).toHaveLength(1);
    expect(data.repositories[0].name).toBe('awesome-project');
  });

  it('should return 401 when not authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/github/enrich');
    
    Object.defineProperty(request, 'cookies', {
      value: {
        get: () => undefined,
      },
    });
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated with GitHub');
  });

  it('should return 401 when missing username', async () => {
    const request = new NextRequest('http://localhost:3000/api/github/enrich');
    
    Object.defineProperty(request, 'cookies', {
      value: {
        get: (name: string) => {
          if (name === 'github_access_token') return { value: 'mock_token' };
          return undefined;
        },
      },
    });
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated with GitHub');
  });
});
