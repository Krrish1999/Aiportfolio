import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/services/analytics';
import { CloudflareWorkersEnv } from '@/config/cloudflare-env';

export const runtime = 'edge';

/**
 * GET /api/analytics
 * Fetch aggregated analytics metrics
 * 
 * Query params:
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 * - sessionId: specific session ID (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareWorkersEnv;
    const analyticsService = new AnalyticsService(env);

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const sessionId = searchParams.get('sessionId');

    // If sessionId is provided, return session-specific analytics
    if (sessionId) {
      const sessionAnalytics = await analyticsService.getSessionAnalytics(sessionId);
      
      if (!sessionAnalytics) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      const timeMetrics = await analyticsService.getSessionTimeMetrics(sessionId);

      return NextResponse.json({
        session: sessionAnalytics,
        timeMetrics,
      });
    }

    // Otherwise, return aggregated metrics
    const aggregatedMetrics = await analyticsService.getAggregatedMetrics(
      startDate,
      endDate
    );

    return NextResponse.json(aggregatedMetrics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/snapshot
 * Create a metrics snapshot for a specific date
 */
export async function POST(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareWorkersEnv;
    const analyticsService = new AnalyticsService(env);

    const body = await request.json() as { date?: string };
    const { date } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'Date is required' },
        { status: 400 }
      );
    }

    await analyticsService.snapshotMetrics(date);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to create snapshot' },
      { status: 500 }
    );
  }
}
