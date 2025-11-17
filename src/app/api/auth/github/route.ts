import { NextRequest, NextResponse } from 'next/server';
import { githubIntegrationService } from '@/services/github-integration';

// Configure edge runtime for Cloudflare Workers
export const runtime = 'edge';

/**
 * GET /api/auth/github
 * Initiates GitHub OAuth flow by redirecting to GitHub authorization page
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const returnUrl = searchParams.get('returnUrl') || '/';
    
    // Generate random state for CSRF protection using Web Crypto API
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const state = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Store state and returnUrl in session/cookie (simplified for now)
    const redirectUri = `${request.nextUrl.origin}/api/auth/github/callback`;
    
    const authUrl = githubIntegrationService.getAuthorizationUrl(redirectUri, state);
    
    const response = NextResponse.redirect(authUrl);
    
    // Store state in cookie for verification in callback
    response.cookies.set('github_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });
    
    // Store return URL
    response.cookies.set('github_oauth_return', returnUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    });
    
    return response;
  } catch (error) {
    console.error('GitHub OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate GitHub authentication' },
      { status: 500 }
    );
  }
}
