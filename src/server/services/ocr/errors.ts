/**
 * OCR Error Classes
 * 
 * Custom error types for OCR processing with detailed error codes.
 */

export enum OcrErrorCode {
  // Configuration errors
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  
  // File validation errors
  UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  INVALID_FILE = "INVALID_FILE",
  
  // API errors
  API_ERROR = "API_ERROR",
  API_PERMISSION_DENIED = "API_PERMISSION_DENIED",
  API_QUOTA_EXCEEDED = "API_QUOTA_EXCEEDED",
  API_RATE_LIMITED = "API_RATE_LIMITED",
  
  // Processing errors
  PROCESSING_FAILED = "PROCESSING_FAILED",
  TIMEOUT = "TIMEOUT",
  NETWORK_ERROR = "NETWORK_ERROR",
  
  // Unknown errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class OcrError extends Error {
  public readonly code: OcrErrorCode;
  public readonly details: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    code: OcrErrorCode,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "OcrError";
    this.code = code;
    this.details = details;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OcrError);
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON(): {
    error: string;
    code: OcrErrorCode;
    message: string;
    details: Record<string, unknown>;
    timestamp: string;
  } {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
    };
  }

  /**
   * Get HTTP status code for this error
   */
  getHttpStatusCode(): number {
    switch (this.code) {
      case OcrErrorCode.CONFIGURATION_ERROR:
        return 500;
      case OcrErrorCode.UNSUPPORTED_FILE_TYPE:
        return 415; // Unsupported Media Type
      case OcrErrorCode.FILE_TOO_LARGE:
        return 413; // Payload Too Large
      case OcrErrorCode.INVALID_FILE:
        return 400; // Bad Request
      case OcrErrorCode.API_PERMISSION_DENIED:
        return 403; // Forbidden
      case OcrErrorCode.API_QUOTA_EXCEEDED:
        return 429; // Too Many Requests
      case OcrErrorCode.API_RATE_LIMITED:
        return 429; // Too Many Requests
      case OcrErrorCode.TIMEOUT:
        return 504; // Gateway Timeout
      case OcrErrorCode.NETWORK_ERROR:
        return 503; // Service Unavailable
      case OcrErrorCode.PROCESSING_FAILED:
      case OcrErrorCode.API_ERROR:
        return 502; // Bad Gateway
      default:
        return 500; // Internal Server Error
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [
      OcrErrorCode.API_ERROR,
      OcrErrorCode.NETWORK_ERROR,
      OcrErrorCode.TIMEOUT,
      OcrErrorCode.PROCESSING_FAILED,
    ].includes(this.code);
  }
}

/**
 * Retry configuration for OCR operations
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (error instanceof OcrError && !error.isRetryable()) {
        throw error;
      }

      if (attempt < config.maxRetries) {
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
        
        // Increase delay for next attempt
        delay = Math.min(
          delay * config.backoffMultiplier,
          config.maxDelayMs
        );
      }
    }
  }

  throw lastError;
}
