import { NextResponse } from 'next/server';

export enum ApiErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  NO_ORGANIZATION = 'NO_ORGANIZATION',
  ORGANIZATION_LOOKUP_FAILED = 'ORGANIZATION_LOOKUP_FAILED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

const STATUS_MAP: Record<ApiErrorCode, number> = {
  [ApiErrorCode.UNAUTHENTICATED]: 401,
  [ApiErrorCode.NO_ORGANIZATION]: 403,
  [ApiErrorCode.ORGANIZATION_LOOKUP_FAILED]: 400,
  [ApiErrorCode.VALIDATION_ERROR]: 400,
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.FORBIDDEN]: 403,
  [ApiErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ApiErrorCode.INTERNAL_ERROR]: 500,
};

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = STATUS_MAP[code];
    this.details = details;
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: this.code,
          message: this.message,
          ...(this.details && { details: this.details }),
        },
      },
      { status: this.statusCode }
    );
  }

  static unauthenticated(message = 'Authentication required') {
    return new ApiError(ApiErrorCode.UNAUTHENTICATED, message);
  }

  static noOrganization(message = 'No organization membership found') {
    return new ApiError(ApiErrorCode.NO_ORGANIZATION, message);
  }

  static organizationLookupFailed(message = 'Organization lookup failed') {
    return new ApiError(ApiErrorCode.ORGANIZATION_LOOKUP_FAILED, message);
  }

  static validationError(message: string, details?: Record<string, unknown>) {
    return new ApiError(ApiErrorCode.VALIDATION_ERROR, message, details);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(ApiErrorCode.NOT_FOUND, message);
  }

  static forbidden(message = 'Access denied') {
    return new ApiError(ApiErrorCode.FORBIDDEN, message);
  }

  static rateLimited(
    message = 'Rate limit exceeded',
    details?: Record<string, unknown>
  ) {
    return new ApiError(ApiErrorCode.RATE_LIMIT_EXCEEDED, message, details);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(ApiErrorCode.INTERNAL_ERROR, message);
  }
}
