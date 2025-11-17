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
    // Get Cloudflare Workers environment from request context
    // In Cloudflare Pages/Workers, the env is available via the platform context
    // Access pattern: request.env (Workers) or via context parameter in Pages Functions
    const env = (request as any).env as CloudflareWorkersEnv | undefined;
    
    if (!env || !isWorkersEnvironment(env)) {
      const error = createError(
        'DATABASE_ERROR',
        'Cloudflare environment not available',
        'Service temporarily unavailable. Please try again later.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

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

    // Convert file to ArrayBuffer for R2 compatibility
    const fileBuffer = await file.arrayBuffer();

    // Create file storage service with Cloudflare environment
    const fileStorageService = createFileStorageService(env);

    // Upload file to R2 storage
    const { key, url } = await fileStorageService.uploadFile(
      fileBuffer,
      file.name,
      file.type,
      userId || undefined
    );

    // Create database service with Cloudflare environment
    const db = createDatabaseService(env);

    // Create or get user if userId provided
    let actualUserId = userId || crypto.randomUUID();
    
    // Try to create resume session in D1 (non-blocking, log errors)
    try {
      await db.createResumeSession({
        userId: actualUserId,
        originalFilename: file.name,
        fileFormat: file.type,
        processingStatus: 'uploaded',
      });
    } catch (dbError) {
      // Log but don't fail the upload if database save fails
      console.warn('Failed to create resume session in database:', dbError);
    }

    // Create queue service with Cloudflare environment
    const queueService = createQueueService(env);

    // Add processing job to Durable Objects queue
    const job = await queueService.addResumeProcessingJob({
      sessionId,
      userId: actualUserId,
      fileKey: key,
      originalFileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

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