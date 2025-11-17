import { NextRequest, NextResponse } from 'next/server';
import { githubIntegrationService } from '@/services/github-integration';

// Configure edge runtime for Cloudflare Workers
export const runtime = 'edge';

/**
 * GET /api/github/enrich
 * Enriches resume data with GitHub information (pinned repos, contributions, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('github_access_token')?.value;
    const username = request.cookies.get('github_username')?.value;
    
    if (!accessToken || !username) {
      return NextResponse.json(
        { error: 'Not authenticated with GitHub' },
        { status: 401 }
      );
    }
    
    const enrichedData = await githubIntegrationService.enrichResumeData(
      username,
      accessToken
    );
    
    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error('Failed to enrich resume data with GitHub:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GitHub data' },
      { status: 500 }
    );
  }
}
