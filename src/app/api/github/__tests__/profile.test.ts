import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../profile/route';
import { NextRequest } from 'next/server';

// Mock the github integration service
vi.mock('@/services/github-integration', () => ({
  githubIntegrationService: {
    getUserProfile: vi.fn(async () => ({
      login: 'testuser',
      name: 'Test User',
      bio: 'Software Engineer',
      location: 'San Francisco',
      email: 'test@example.com',
      blog: 'https://testuser.dev',
      company: 'Tech Corp',
      avatarUrl: 'https://avatar.url',
      publicRepos: 42,
      followers: 100,
      following: 50,
    })),
  },
}));

describe('GET /api/github/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return GitHub profile for authenticated user', async () => {
    const request = new NextRequest('http://localhost:3000/api/github/profile');
    
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
    
    expect(response.status).toBe(200);
    expect(data.login).toBe('testuser');
    expect(data.name).toBe('Test User');
    expect(data.publicRepos).toBe(42);
  });

  it('should return 401 when not authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/github/profile');
    
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
});
