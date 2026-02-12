/**
 * Export Download API Route
 * GET /api/exports/[exportId]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/client';
import { storage } from '@/src/lib/storage';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> }
) {
  try {
    const { exportId } = await params;
    const { organizationId } = await getMyOrganizationIdOrThrow();

    const exportRecord = await prisma.export.findFirst({
      where: {
        id: exportId,
        organizationId,
      },
    });

    if (!exportRecord) {
      throw ApiError.notFound('Export not found');
    }

    if (exportRecord.status !== 'READY') {
      throw ApiError.validationError('Export not ready', {
        status: exportRecord.status,
      });
    }

    if (!exportRecord.storageKey) {
      throw ApiError.notFound('Export file not found');
    }

    const fileBuffer = await storage.download(exportRecord.storageKey);

    if (!fileBuffer) {
      throw ApiError.notFound('Export file not found in storage');
    }

    const contentTypeMap: Record<string, string> = {
      DATEV: 'text/csv; charset=utf-8',
      CSV: 'text/csv; charset=utf-8',
    };
    const contentType =
      contentTypeMap[exportRecord.format] ?? 'application/octet-stream';

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${exportRecord.filename}"`,
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to download export');
    return ApiError.internal('Failed to download export').toResponse();
  }
}
