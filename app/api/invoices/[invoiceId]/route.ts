import { NextResponse } from 'next/server';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    await getMyOrganizationIdOrThrow();
    const { invoiceId } = await params;

    return NextResponse.json({
      success: true,
      message: `Invoice ${invoiceId} - coming soon`,
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to get invoice');
    return ApiError.internal().toResponse();
  }
}

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    await getMyOrganizationIdOrThrow();
    const { invoiceId } = await params;

    return NextResponse.json({
      success: true,
      message: `Update invoice ${invoiceId} - coming soon`,
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to update invoice');
    return ApiError.internal().toResponse();
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    await getMyOrganizationIdOrThrow();
    const { invoiceId } = await params;

    return NextResponse.json({
      success: true,
      message: `Delete invoice ${invoiceId} - coming soon`,
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to delete invoice');
    return ApiError.internal().toResponse();
  }
}
