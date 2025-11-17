import { NextRequest, NextResponse } from 'next/server';
import { githubIntegrationService } from '@/services/github-integration';

// Configure edge runtime for Cloudflare Workers
export const runtime = 'edge';

/**
 * GET /api/auth/github/callback
 * Handles GitHub OAuth callback and exchanges code for access token
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Check for OAuth errors
    if (error) {
      console.error('GitHub OAuth error:', error);
      return NextResponse.redirect(
        `${request.nextUrl.origin}?error=github_auth_failed`
      );
    }
    
    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}?error=invalid_callback`
      );
    }
    
    // Verify state to prevent CSRF attacks
    const storedState = request.cookies.get('github_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}?error=invalid_state`
      );
    }
    
    // Exchange code for access token
    const redirectUri = `${request.nextUrl.origin}/api/auth/github/callback`;
    const accessToken = await githubIntegrationService.exchangeCodeForToken(
      code,
      redirectUri
    );
    
    // Get user profile to retrieve username
    const profile = await githubIntegrationService.getUserProfile(accessToken);
    
    // Get return URL from cookie
    const returnUrl = request.cookies.get('github_oauth_return')?.value || '/';
    
    // Create response with redirect
    const response = NextResponse.redirect(`${request.nextUrl.origin}${returnUrl}`);
    
    // Store access token in secure cookie
    response.cookies.set('github_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    
    // Store username for easy access
    response.cookies.set('github_username', profile.login, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
    
    // Clear temporary OAuth cookies
    response.cookies.delete('github_oauth_state');
    response.cookies.delete('github_oauth_return');
    
    return response;
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(
      `${request.nextUrl.origin}?error=github_auth_failed`
    );
  }
}
