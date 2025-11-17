import { NextRequest, NextResponse } from 'next/server';
import { createQueueService } from '@/services/queue';
import { createError, formatErrorResponse, isResumeProcessingError } from '@/utils/errors';
import { CloudflareWorkersEnv, isWorkersEnvironment } from '@/config/cloudflare-env';

// Configure edge runtime for Cloudflare Workers
export const runtime = 'edge';

export async function DELETE(
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

    // Create queue service with Cloudflare environment
    const queueService = createQueueService(env);

    // Get job status first to check if it exists and get file info
    const jobStatus = await queueService.getJobStatus(sessionId);
    
    if (jobStatus.status === 'not_found') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found. The processing may have already completed or never existed.',
          recoverable: false,
        },
      }, { status: 404 });
    }

    // Check if job can be cancelled
    if (jobStatus.status === 'completed') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CANNOT_CANCEL_COMPLETED',
          message: 'Cannot cancel a completed processing job.',
          recoverable: false,
        },
      }, { status: 400 });
    }

    // Cancel the job via Durable Objects
    await queueService.cancelJob(sessionId);

    // Optionally clean up uploaded file
    // Note: In a real implementation, you might want to keep the file for a while
    // or have a separate cleanup process
    const cleanupFile = request.nextUrl.searchParams.get('cleanup') === 'true';
    
    if (cleanupFile) {
      try {
        // This would require storing the file key somewhere accessible
        // For now, we'll just log that cleanup was requested
        console.log(`File cleanup requested for session ${sessionId}`);
      } catch (cleanupError) {
        console.warn(`Failed to cleanup file for session ${sessionId}:`, cleanupError);
        // Don't fail the cancellation if cleanup fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        message: 'Processing cancelled successfully.',
        cancelledAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Cancel processing error:', error);

    if (isResumeProcessingError(error)) {
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Handle unexpected errors
    const unexpectedError = createError(
      'DATABASE_ERROR',
      `Unexpected cancellation error: ${error}`,
      'Failed to cancel processing. Please try again.'
    );
    
    return NextResponse.json(formatErrorResponse(unexpectedError), { 
      status: unexpectedError.statusCode 
    });
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

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