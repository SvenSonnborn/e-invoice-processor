import { NextResponse } from 'next/server';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';

export async function GET() {
  try {
    await getMyOrganizationIdOrThrow();

    return NextResponse.json({
      success: true,
      message: 'Uploads API - coming soon',
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to list uploads');
    return ApiError.internal().toResponse();
  }
}

export async function POST() {
  try {
    await getMyOrganizationIdOrThrow();

    return NextResponse.json(
      { success: true, message: 'Create upload - coming soon' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to create upload');
    return ApiError.internal().toResponse();
  }
}
