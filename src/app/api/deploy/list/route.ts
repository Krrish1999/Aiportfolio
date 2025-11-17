import { NextRequest, NextResponse } from 'next/server';
import { DeploymentService } from '@/services/deployment';
import { createError, formatErrorResponse, isResumeProcessingError } from '@/utils/errors';

// Configure edge runtime for Cloudflare Workers
export const runtime = 'edge';

/**
 * GET /api/deploy/list
 * List all deployments
 */
export async function GET(request: NextRequest) {
  try {
    // Get Cloudflare credentials from environment
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      const error = createError(
        'DATABASE_ERROR',
        'Cloudflare credentials not configured',
        'Deployment service is not properly configured.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Create deployment service
    const deploymentService = new DeploymentService(accountId, apiToken);

    // Get all deployments
    const deployments = deploymentService.listDeployments();

    // Format deployments with Cloudflare Pages URLs
    const formattedDeployments = deployments.map(deployment => ({
      deploymentId: deployment.deploymentId,
      status: deployment.status,
      url: deployment.url, // *.pages.dev URL
      platform: 'cloudflare-pages',
      createdAt: deployment.createdAt,
      completedAt: deployment.completedAt,
      error: deployment.error,
    }));

    // Return list of deployments
    return NextResponse.json({
      success: true,
      data: {
        deployments: formattedDeployments,
        total: formattedDeployments.length,
      },
    });

  } catch (error) {
    console.error('List deployments error:', error);

    if (isResumeProcessingError(error)) {
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Handle unexpected errors
    const unexpectedError = createError(
      'DATABASE_ERROR',
      `Unexpected error: ${error}`,
      'An unexpected error occurred. Please try again.'
    );
    
    return NextResponse.json(formatErrorResponse(unexpectedError), { 
      status: unexpectedError.statusCode 
    });
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST /api/deploy to create a deployment.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
