export class ResumeProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean,
    public userMessage: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ResumeProcessingError';
  }
}

export const ERROR_CODES = {
  UNSUPPORTED_FORMAT: {
    code: 'UNSUPPORTED_FORMAT',
    recoverable: true,
    action: 'convert_format',
    statusCode: 400,
  },
  PARSING_FAILED: {
    code: 'PARSING_FAILED',
    recoverable: true,
    action: 'manual_input',
    statusCode: 422,
  },
  AI_GENERATION_FAILED: {
    code: 'AI_GENERATION_FAILED',
    recoverable: true,
    action: 'use_original',
    statusCode: 503,
  },
  DEPLOYMENT_FAILED: {
    code: 'DEPLOYMENT_FAILED',
    recoverable: true,
    action: 'retry_deployment',
    statusCode: 503,
  },
  INTEGRATION_FAILED: {
    code: 'INTEGRATION_FAILED',
    recoverable: true,
    action: 'skip_integration',
    statusCode: 503,
  },
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    recoverable: false,
    action: 'reduce_file_size',
    statusCode: 413,
  },
  INVALID_FILE_TYPE: {
    code: 'INVALID_FILE_TYPE',
    recoverable: false,
    action: 'use_supported_format',
    statusCode: 400,
  },
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    recoverable: true,
    action: 'retry_operation',
    statusCode: 500,
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    recoverable: false,
    action: 'check_input',
    statusCode: 400,
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    recoverable: false,
    action: 'check_resource',
    statusCode: 404,
  },
  RATE_LIMIT: {
    code: 'RATE_LIMIT',
    recoverable: true,
    action: 'retry_later',
    statusCode: 429,
  },
  TIMEOUT: {
    code: 'TIMEOUT',
    recoverable: true,
    action: 'retry_operation',
    statusCode: 504,
  },
  RESOURCE_ERROR: {
    code: 'RESOURCE_ERROR',
    recoverable: true,
    action: 'optimize_operation',
    statusCode: 507,
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    recoverable: true,
    action: 'retry_operation',
    statusCode: 500,
  },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function createError(
  errorCode: ErrorCode,
  message?: string,
  userMessage?: string
): ResumeProcessingError {
  const errorConfig = ERROR_CODES[errorCode];
  return new ResumeProcessingError(
    message || `Error: ${errorCode}`,
    errorConfig.code,
    errorConfig.recoverable,
    userMessage || `An error occurred: ${errorCode}`,
    errorConfig.statusCode
  );
}

export function isResumeProcessingError(error: unknown): error is ResumeProcessingError {
  return error instanceof ResumeProcessingError;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    recoverable: boolean;
    action?: string;
  };
}

export function formatErrorResponse(error: ResumeProcessingError): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.userMessage,
      recoverable: error.recoverable,
      action: ERROR_CODES[error.code as ErrorCode]?.action,
    },
  };
}
/**
 * 
CloudflareErrorHandler - Utility class for handling Cloudflare-specific errors
 * 
 * Provides specialized error handling for R2, D1, KV, and Workers errors with
 * appropriate error codes, user messages, and retry strategies.
 */
export class CloudflareErrorHandler {
  /**
   * Handle R2 (object storage) errors
   */
  static handleR2Error(error: any): never {
    // NoSuchKey - file not found
    if (error.message?.includes('NoSuchKey') || error.message?.includes('not found')) {
      throw createError(
        'NOT_FOUND',
        `R2 error: ${error.message}`,
        'The requested file does not exist in storage.'
      );
    }

    // EntityTooLarge - file size exceeds limit
    if (error.message?.includes('EntityTooLarge') || error.message?.includes('too large')) {
      throw createError(
        'FILE_TOO_LARGE',
        `R2 error: ${error.message}`,
        'File size exceeds the maximum allowed limit of 100MB.'
      );
    }

    // Rate limit errors
    if (
      error.message?.includes('rate limit') ||
      error.message?.includes('too many requests') ||
      error.status === 429
    ) {
      throw createError(
        'RATE_LIMIT',
        `R2 rate limit: ${error.message}`,
        'Too many storage requests. Please try again in a moment.'
      );
    }

    // Access denied / permission errors
    if (error.message?.includes('AccessDenied') || error.message?.includes('Forbidden')) {
      throw createError(
        'VALIDATION_ERROR',
        `R2 access error: ${error.message}`,
        'Access to the requested file is denied.'
      );
    }

    // Generic R2 error
    throw createError(
      'DATABASE_ERROR',
      `R2 storage error: ${error.message || 'Unknown error'}`,
      'Storage operation failed. Please try again.'
    );
  }

  /**
   * Handle D1 (database) errors
   */
  static handleD1Error(error: any): never {
    const errorMessage = error.message || '';

    // UNIQUE constraint violation
    if (errorMessage.includes('UNIQUE constraint') || errorMessage.includes('unique')) {
      throw createError(
        'VALIDATION_ERROR',
        `D1 error: ${errorMessage}`,
        'A record with this information already exists.'
      );
    }

    // FOREIGN KEY constraint violation
    if (errorMessage.includes('FOREIGN KEY constraint') || errorMessage.includes('foreign key')) {
      throw createError(
        'VALIDATION_ERROR',
        `D1 error: ${errorMessage}`,
        'Referenced record does not exist or cannot be deleted due to dependencies.'
      );
    }

    // SQL syntax errors
    if (
      errorMessage.includes('syntax error') ||
      errorMessage.includes('near') ||
      errorMessage.includes('unexpected')
    ) {
      throw createError(
        'INTERNAL_ERROR',
        `D1 syntax error: ${errorMessage}`,
        'Database query error. Please contact support.'
      );
    }

    // NOT NULL constraint violation
    if (errorMessage.includes('NOT NULL constraint')) {
      throw createError(
        'VALIDATION_ERROR',
        `D1 error: ${errorMessage}`,
        'Required field is missing.'
      );
    }

    // Database locked (concurrent access)
    if (errorMessage.includes('database is locked') || errorMessage.includes('SQLITE_BUSY')) {
      throw createError(
        'TIMEOUT',
        `D1 error: ${errorMessage}`,
        'Database is busy. Please try again.'
      );
    }

    // Rate limit errors
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      throw createError(
        'RATE_LIMIT',
        `D1 rate limit: ${errorMessage}`,
        'Too many database requests. Please try again in a moment.'
      );
    }

    // Generic D1 error
    throw createError(
      'DATABASE_ERROR',
      `D1 database error: ${errorMessage || 'Unknown error'}`,
      'Database operation failed. Please try again.'
    );
  }

  /**
   * Handle KV (key-value storage) errors
   */
  static handleKVError(error: any): never {
    const errorMessage = error.message || '';

    // Quota exceeded
    if (
      errorMessage.includes('quota') ||
      errorMessage.includes('limit exceeded') ||
      errorMessage.includes('storage limit')
    ) {
      throw createError(
        'RESOURCE_ERROR',
        `KV quota error: ${errorMessage}`,
        'Storage quota exceeded. Please contact support.'
      );
    }

    // Rate limit errors
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      error.status === 429
    ) {
      throw createError(
        'RATE_LIMIT',
        `KV rate limit: ${errorMessage}`,
        'Too many cache requests. Please try again in a moment.'
      );
    }

    // Key too large
    if (errorMessage.includes('key too large') || errorMessage.includes('key size')) {
      throw createError(
        'VALIDATION_ERROR',
        `KV error: ${errorMessage}`,
        'Cache key is too large.'
      );
    }

    // Value too large
    if (errorMessage.includes('value too large') || errorMessage.includes('value size')) {
      throw createError(
        'VALIDATION_ERROR',
        `KV error: ${errorMessage}`,
        'Cache value is too large (max 25MB).'
      );
    }

    // Generic KV error
    throw createError(
      'DATABASE_ERROR',
      `KV cache error: ${errorMessage || 'Unknown error'}`,
      'Cache operation failed. Please try again.'
    );
  }

  /**
   * Handle Workers runtime errors
   */
  static handleWorkerError(error: any): never {
    const errorMessage = error.message || '';

    // CPU time limit exceeded
    if (
      errorMessage.includes('CPU time limit') ||
      errorMessage.includes('exceeded CPU') ||
      errorMessage.includes('script execution time')
    ) {
      throw createError(
        'TIMEOUT',
        `Worker timeout: ${errorMessage}`,
        'Operation took too long to process. Please try with a smaller file or simpler operation.'
      );
    }

    // Memory limit exceeded
    if (
      errorMessage.includes('memory limit') ||
      errorMessage.includes('out of memory') ||
      errorMessage.includes('heap')
    ) {
      throw createError(
        'RESOURCE_ERROR',
        `Worker memory error: ${errorMessage}`,
        'Operation requires too much memory. Please try with a smaller file.'
      );
    }

    // Script size limit
    if (errorMessage.includes('script size') || errorMessage.includes('too large')) {
      throw createError(
        'INTERNAL_ERROR',
        `Worker size error: ${errorMessage}`,
        'Application code is too large. Please contact support.'
      );
    }

    // Subrequest limit
    if (errorMessage.includes('subrequest') || errorMessage.includes('fetch limit')) {
      throw createError(
        'RESOURCE_ERROR',
        `Worker subrequest limit: ${errorMessage}`,
        'Too many external requests. Please try again.'
      );
    }

    // Generic Worker error
    throw createError(
      'INTERNAL_ERROR',
      `Worker error: ${errorMessage || 'Unknown error'}`,
      'Internal server error. Please try again.'
    );
  }

  /**
   * Determine if an error is retryable
   */
  static isRetryableError(error: any): boolean {
    if (isResumeProcessingError(error)) {
      return error.recoverable;
    }

    const errorMessage = error.message || '';

    // Network errors are retryable
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT')
    ) {
      return true;
    }

    // Rate limits are retryable
    if (errorMessage.includes('rate limit') || error.status === 429) {
      return true;
    }

    // Temporary errors are retryable
    if (
      errorMessage.includes('temporarily unavailable') ||
      errorMessage.includes('try again') ||
      errorMessage.includes('database is locked')
    ) {
      return true;
    }

    // 5xx errors are generally retryable
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    return false;
  }

  /**
   * Handle any Cloudflare service error with appropriate error type
   */
  static handleError(error: any, service: 'R2' | 'D1' | 'KV' | 'Worker'): never {
    switch (service) {
      case 'R2':
        return CloudflareErrorHandler.handleR2Error(error);
      case 'D1':
        return CloudflareErrorHandler.handleD1Error(error);
      case 'KV':
        return CloudflareErrorHandler.handleKVError(error);
      case 'Worker':
        return CloudflareErrorHandler.handleWorkerError(error);
      default:
        throw createError(
          'INTERNAL_ERROR',
          `Unknown service error: ${error.message}`,
          'An unexpected error occurred. Please try again.'
        );
    }
  }
}

/**
 * Retry utility with exponential backoff for transient failures
 * 
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param backoffMs - Initial backoff delay in milliseconds (default: 1000)
 * @param service - Optional service name for error handling
 * @returns The result of the operation
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000,
  service?: 'R2' | 'D1' | 'KV' | 'Worker'
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry if error is not retryable
      if (!CloudflareErrorHandler.isRetryableError(error)) {
        // If service is specified, handle the error appropriately
        if (service) {
          CloudflareErrorHandler.handleError(error, service);
        }
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt < maxRetries - 1) {
        // Calculate backoff with jitter to prevent thundering herd
        const jitter = Math.random() * 0.3 * backoffMs; // 0-30% jitter
        const delay = backoffMs * Math.pow(2, attempt) + jitter;

        // Cap maximum delay at 30 seconds
        const cappedDelay = Math.min(delay, 30000);

        await new Promise((resolve) => setTimeout(resolve, cappedDelay));
      }
    }
  }

  // All retries exhausted, handle the error if service is specified
  if (service) {
    CloudflareErrorHandler.handleError(lastError, service);
  }

  throw lastError;
}
