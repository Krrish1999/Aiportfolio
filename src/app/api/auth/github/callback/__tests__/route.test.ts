import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// Mock the github integration service
vi.mock('@/services/github-integration', () => ({
  githubIntegrationService: {
    exchangeCodeForToken: vi.fn(async () => 'mock_access_token'),
    getUserProfile: vi.fn(async () => ({
      login: 'testuser',
      name: 'Test User',
      bio: 'Developer',
      location: 'SF',
      email: 'test@example.com',
      blog: null,
      company: null,
      avatarUrl: 'https://avatar.url',
      publicRepos: 20,
      followers: 50,
      following: 30,
    })),
  },
}));

describe('GET /api/auth/github/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle successful OAuth callback', async () => {
    const state = 'test_state_123';
    const code = 'test_code_456';
    
    const request = new NextRequest(
      `http://localhost:3000/api/auth/github/callback?code=${code}&state=${state}`
    );
    
    // Mock cookies
    Object.defineProperty(request, 'cookies', {
      value: {
        get: (name: string) => {
          if (name === 'github_oauth_state') return { value: state };
          if (name === 'github_oauth_return') return { value: '/' };
          return undefined;
        },
      },
    });
    
    const response = await GET(request);
    
    expect(response.status).toBe(307); // Redirect
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('should reject callback with invalid state', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auth/github/callback?code=test&state=wrong_state'
    );
    
    Object.defineProperty(request, 'cookies', {
      value: {
        get: (name: string) => {
          if (name === 'github_oauth_state') return { value: 'correct_state' };
          return undefined;
        },
      },
    });
    
    const response = await GET(request);
    
    expect(response.headers.get('location')).toContain('error=invalid_state');
  });

  it('should handle OAuth errors', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auth/github/callback?error=access_denied'
    );
    
    const response = await GET(request);
    
    expect(response.headers.get('location')).toContain('error=github_auth_failed');
  });

  it('should reject callback without code', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auth/github/callback?state=test'
    );
    
    const response = await GET(request);
    
    expect(response.headers.get('location')).toContain('error=invalid_callback');
  });
});
