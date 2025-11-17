import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// Mock the github integration service
vi.mock('@/services/github-integration', () => ({
  githubIntegrationService: {
    getAuthorizationUrl: vi.fn((redirectUri: string, state: string) => {
      return `https://github.com/login/oauth/authorize?client_id=test&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    }),
  },
}));

describe('GET /api/auth/github', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect to GitHub authorization URL', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/github');
    
    const response = await GET(request);
    
    expect(response.status).toBe(307); // Redirect status
    expect(response.headers.get('location')).toContain('https://github.com/login/oauth/authorize');
    expect(response.headers.get('location')).toContain('client_id=test');
  });

  it('should set state cookie for CSRF protection', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/github');
    
    const response = await GET(request);
    
    const cookies = response.headers.get('set-cookie');
    expect(cookies).toContain('github_oauth_state');
  });

  it('should preserve return URL in cookie', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/github?returnUrl=/editor');
    
    const response = await GET(request);
    
    const cookies = response.headers.get('set-cookie');
    expect(cookies).toContain('github_oauth_return');
  });
});
