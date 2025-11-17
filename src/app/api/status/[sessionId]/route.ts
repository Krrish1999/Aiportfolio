import { NextRequest, NextResponse } from 'next/server';
import { createQueueService } from '@/services/queue';
import { createDatabaseService } from '@/config/database';
import { createError, formatErrorResponse, isResumeProcessingError } from '@/utils/errors';
import { CloudflareWorkersEnv, isWorkersEnvironment } from '@/config/cloudflare-env';

// Configure edge runtime for Cloudflare Workers
export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;

    // Validate session ID
    if (!sessionId || typeof sessionId !== 'string') {
      const error = createError(
        'INVALID_FILE_TYPE',
        'Invalid session ID',
        'Invalid session ID provided.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Get Cloudflare Workers environment from request context
    const env = (request as any).env as CloudflareWorkersEnv | undefined;
    
    if (!env || !isWorkersEnvironment(env)) {
      const error = createError(
        'DATABASE_ERROR',
        'Cloudflare environment not available',
        'Service temporarily unavailable. Please try again later.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Create database service with Cloudflare environment
    const db = createDatabaseService(env);

    // Get resume session from D1
    const session = await db.getResumeSession(sessionId);

    // Create queue service with Cloudflare environment
    const queueService = createQueueService(env);

    // Get job status from Durable Objects queue
    const jobStatus = await queueService.getJobStatus(sessionId);

    // Map Durable Object status to user-friendly status
    const statusMap: Record<string, string> = {
      'pending': 'queued',
      'processing': 'processing',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'not_found': 'not_found',
    };

    const userStatus = statusMap[jobStatus.status] || 'unknown';

    // If session exists in D1, include parsed data
    let parsedData = null;
    if (session && session.parsed_data) {
      parsedData = db.getParsedData(session);
    }

    // Prepare response data
    const responseData = {
      sessionId,
      status: userStatus,
      progress: jobStatus.progress,
      message: getStatusMessage(userStatus, jobStatus.progress),
      ...(jobStatus.data && { result: jobStatus.data }),
      ...(parsedData && { parsedData }),
      ...(jobStatus.error && { error: jobStatus.error }),
    };

    // Handle different status codes
    if (userStatus === 'not_found') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found. The processing may have expired or never existed.',
          recoverable: false,
        },
      }, { status: 404 });
    }

    if (userStatus === 'failed') {
      return NextResponse.json({
        success: false,
        data: responseData,
        error: {
          code: 'PROCESSING_FAILED',
          message: jobStatus.error || 'Processing failed for unknown reason.',
          recoverable: true,
        },
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });

  } catch (error) {
    console.error('Status check error:', error);

    if (isResumeProcessingError(error)) {
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Handle unexpected errors
    const unexpectedError = createError(
      'DATABASE_ERROR',
      `Unexpected status check error: ${error}`,
      'Failed to check processing status. Please try again.'
    );
    
    return NextResponse.json(formatErrorResponse(unexpectedError), { 
      status: unexpectedError.statusCode 
    });
  }
}

/**
 * Get user-friendly status message based on status and progress
 */
function getStatusMessage(status: string, progress: number): string {
  switch (status) {
    case 'queued':
      return 'Your resume is in the processing queue. Processing will begin shortly.';
    case 'processing':
      if (progress < 30) {
        return 'Downloading and preparing your resume for processing...';
      } else if (progress < 60) {
        return 'Extracting text and content from your resume...';
      } else if (progress < 90) {
        return 'Parsing and analyzing resume content...';
      } else {
        return 'Finalizing processing and validating extracted data...';
      }
    case 'completed':
      return 'Resume processing completed successfully!';
    case 'failed':
      return 'Resume processing failed. Please try uploading again.';
    case 'not_found':
      return 'Processing session not found.';
    default:
      return 'Processing status unknown.';
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
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