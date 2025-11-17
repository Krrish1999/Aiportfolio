import { NextRequest, NextResponse } from 'next/server';
import { githubIntegrationService } from '@/services/github-integration';

// Configure edge runtime for Cloudflare Workers
export const runtime = 'edge';

/**
 * GET /api/github/profile
 * Fetches GitHub profile data for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('github_access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with GitHub' },
        { status: 401 }
      );
    }
    
    const profile = await githubIntegrationService.getUserProfile(accessToken);
    
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Failed to fetch GitHub profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GitHub profile' },
      { status: 500 }
    );
  }
}
