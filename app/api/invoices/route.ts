import { NextResponse } from 'next/server';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';

export async function GET() {
  try {
    await getMyOrganizationIdOrThrow();

    return NextResponse.json({
      success: true,
      message: 'Invoices API - coming soon',
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to list invoices');
    return ApiError.internal().toResponse();
  }
}

export async function POST() {
  try {
    await getMyOrganizationIdOrThrow();

    return NextResponse.json(
      { success: true, message: 'Create invoice - coming soon' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to create invoice');
    return ApiError.internal().toResponse();
  }
}
