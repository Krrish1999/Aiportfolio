import { NextRequest, NextResponse } from 'next/server';
import { DeploymentService } from '@/services/deployment';
import { createError, formatErrorResponse, isResumeProcessingError } from '@/utils/errors';

// Configure edge runtime for Cloudflare Workers
export const runtime = 'edge';

/**
 * GET /api/deploy/[deploymentId]
 * Get deployment status and details
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ deploymentId: string }> }
) {
  try {
    const { deploymentId } = await context.params;

    if (!deploymentId) {
      const error = createError(
        'VALIDATION_ERROR',
        'Missing deployment ID',
        'Deployment ID is required.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

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

    // Get deployment status
    const status = deploymentService.getDeploymentStatus(deploymentId);

    if (!status) {
      const error = createError(
        'NOT_FOUND',
        'Deployment not found',
        'The requested deployment does not exist.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Return deployment status with Cloudflare Pages URL format
    return NextResponse.json({
      success: true,
      data: {
        deploymentId: status.deploymentId,
        status: status.status,
        url: status.url, // *.pages.dev URL
        platform: 'cloudflare-pages',
        createdAt: status.createdAt,
        completedAt: status.completedAt,
        error: status.error,
      },
    });

  } catch (error) {
    console.error('Get deployment status error:', error);

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

/**
 * DELETE /api/deploy/[deploymentId]
 * Delete a deployment
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ deploymentId: string }> }
) {
  try {
    const { deploymentId } = await context.params;

    if (!deploymentId) {
      const error = createError(
        'VALIDATION_ERROR',
        'Missing deployment ID',
        'Deployment ID is required.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

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

    // Delete deployment
    const deleted = await deploymentService.deleteDeployment(deploymentId);

    if (!deleted) {
      const error = createError(
        'NOT_FOUND',
        'Deployment not found or already deleted',
        'The requested deployment does not exist or has already been deleted.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        deploymentId,
        message: 'Deployment deleted successfully from Cloudflare Pages.',
      },
    });

  } catch (error) {
    console.error('Delete deployment error:', error);

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
