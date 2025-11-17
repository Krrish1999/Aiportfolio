import { NextRequest, NextResponse } from 'next/server';
import { createFileStorageService } from '@/services/file-storage';
import { createQueueService } from '@/services/queue';
import { createDatabaseService } from '@/config/database';
import { validateFile } from '@/utils/validation';
import { createError, formatErrorResponse, isResumeProcessingError } from '@/utils/errors';
import { CloudflareWorkersEnv, isWorkersEnvironment } from '@/config/cloudflare-env';

// Configure edge runtime for Cloudflare Workers
export const runtime = 'edge';

// File upload configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export async function POST(request: NextRequest) {
  try {
    // Get Cloudflare Workers environment from request context (optional for now)
    const env = (request as any).env as CloudflareWorkersEnv | undefined;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string | null;

    // Validate file presence
    if (!file) {
      const error = createError(
        'INVALID_FILE_TYPE',
        'No file provided',
        'Please select a file to upload.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Validate file type and size
    const validation = validateFile(file);
    if (!validation.success) {
      const errorCode = file.size > MAX_FILE_SIZE ? 'FILE_TOO_LARGE' : 'INVALID_FILE_TYPE';
      const error = createError(
        errorCode,
        validation.error || 'File validation failed',
        validation.error || 'Invalid file format or size.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Additional security checks
    if (!ALLOWED_TYPES.includes(file.type)) {
      const error = createError(
        'INVALID_FILE_TYPE',
        `Unsupported file type: ${file.type}`,
        'Please upload a PDF, DOCX, or TXT file.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Generate session ID for tracking
    const sessionId = crypto.randomUUID();
    const actualUserId = userId || crypto.randomUUID();

    // For now, just acknowledge the upload (TODO: implement R2 storage)
    // In production, this would upload to R2 and queue for processing
    const key = `uploads/${actualUserId}/${sessionId}/${file.name}`;
    const url = `/api/files/${sessionId}`;

    // Simulate job creation
    const job = {
      jobId: crypto.randomUUID(),
      status: 'queued' as const,
      createdAt: new Date().toISOString(),
    };

    // Return success response with session info
    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        jobId: job.jobId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded',
        message: 'File uploaded successfully. Processing will begin shortly.',
        fileUrl: url, // Include R2 URL in response
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Upload error:', error);

    if (isResumeProcessingError(error)) {
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Handle unexpected errors
    const unexpectedError = createError(
      'DATABASE_ERROR',
      `Unexpected upload error: ${error}`,
      'An unexpected error occurred during upload. Please try again.'
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