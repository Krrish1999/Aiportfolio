/**
 * User data management API endpoints
 * Handles data deletion, export, and consent management
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDataRetentionService } from '@/services/data-retention';
import { CloudflareWorkersEnv } from '@/config/cloudflare-env';

export const runtime = 'edge';

// This would be replaced with actual auth middleware
function getUserIdFromRequest(request: NextRequest): string | null {
  // In production, extract from JWT token or session
  const userId = request.headers.get('x-user-id');
  return userId;
}

/**
 * GET /api/user/data - Export user data
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Cloudflare environment from request context
    const env = (request as any).env as CloudflareWorkersEnv;
    if (!env) {
      return NextResponse.json(
        { error: 'Environment not configured' },
        { status: 500 }
      );
    }

    const retentionService = createDataRetentionService(env);
    const userData = await retentionService.exportUserData(userId);

    return NextResponse.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    return NextResponse.json(
      { error: 'Failed to export user data' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/data - Delete user data
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json() as { 
      immediate?: boolean; 
      retentionPolicy?: { 
        retainPortfolio: boolean; 
        retainMetrics: boolean;
        deleteSourceFiles: boolean;
        deletePersonalData: boolean;
      } 
    };
    const { immediate, retentionPolicy } = body;

    const env = (request as any).env as CloudflareWorkersEnv;
    if (!env) {
      return NextResponse.json(
        { error: 'Environment not configured' },
        { status: 500 }
      );
    }

    const retentionService = createDataRetentionService(env);

    if (immediate) {
      // Immediate deletion
      const result = await retentionService.deleteUserData(userId);
      
      return NextResponse.json({
        success: result.success,
        message: 'User data deleted successfully',
        result,
      });
    } else if (retentionPolicy) {
      // Selective retention
      const result = await retentionService.applyRetentionPolicy(userId, retentionPolicy);
      
      return NextResponse.json({
        success: result.success,
        message: 'Retention policy applied successfully',
        result,
      });
    } else {
      // Schedule deletion for 24 hours from now
      const deletionDate = new Date();
      deletionDate.setHours(deletionDate.getHours() + 24);
      
      await retentionService.scheduleDeletion(userId, deletionDate);
      
      return NextResponse.json({
        success: true,
        message: 'Data deletion scheduled',
        scheduledFor: deletionDate.toISOString(),
      });
    }
  } catch (error) {
    console.error('Error deleting user data:', error);
    return NextResponse.json(
      { error: 'Failed to delete user data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/data/consent - Update user consent
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const consent = await request.json() as Partial<{ dataProcessing: boolean; analytics: boolean; marketing: boolean }>;

    const env = (request as any).env as CloudflareWorkersEnv;
    if (!env) {
      return NextResponse.json(
        { error: 'Environment not configured' },
        { status: 500 }
      );
    }

    const retentionService = createDataRetentionService(env);
    await retentionService.updateUserConsent(userId, consent);

    return NextResponse.json({
      success: true,
      message: 'Consent updated successfully',
    });
  } catch (error) {
    console.error('Error updating consent:', error);
    return NextResponse.json(
      { error: 'Failed to update consent' },
      { status: 500 }
    );
  }
}
