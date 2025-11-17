import { NextRequest, NextResponse } from 'next/server';
import { DeploymentService } from '@/services/deployment';
import { createError, formatErrorResponse, isResumeProcessingError } from '@/utils/errors';

// Configure edge runtime for Cloudflare Workers
export const runtime = 'edge';

/**
 * POST /api/deploy/[deploymentId]/domain
 * Setup custom domain for a deployment
 */
export async function POST(
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

    // Parse request body
    const body = await request.json() as { domain?: string; projectName?: string };
    const { domain, projectName } = body;

    if (!domain || !projectName) {
      const error = createError(
        'VALIDATION_ERROR',
        'Missing required fields',
        'Domain and project name are required.'
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

    // Setup custom domain
    const result = await deploymentService.setupCustomDomain({
      domain,
      deploymentId,
      sslEnabled: true,
      projectName,
    });

    if (!result.success) {
      const error = createError(
        'DATABASE_ERROR',
        result.error || 'Failed to setup custom domain',
        'Failed to configure custom domain. Please check your domain settings.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        deploymentId,
        domain,
        projectName,
        platform: 'cloudflare-pages',
        message: 'Custom domain configured successfully. DNS propagation may take a few minutes.',
        dnsRecords: result.dnsRecords,
        sslStatus: result.sslStatus,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Setup custom domain error:', error);

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
 * GET /api/deploy/[deploymentId]/domain
 * Get custom domain status
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

    // Get deployment status to check for custom domain
    const status = deploymentService.getDeploymentStatus(deploymentId);

    if (!status) {
      const error = createError(
        'NOT_FOUND',
        'Deployment not found',
        'The requested deployment does not exist.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Return domain status
    return NextResponse.json({
      success: true,
      data: {
        deploymentId,
        hasCustomDomain: !!status.customDomain,
        customDomain: status.customDomain,
        platform: 'cloudflare-pages',
      },
    });

  } catch (error) {
    console.error('Get custom domain status error:', error);

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
