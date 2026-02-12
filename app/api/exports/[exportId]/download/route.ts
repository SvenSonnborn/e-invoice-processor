/**
 * Export Download API Route
 * GET /api/exports/[exportId]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/client';
import { storage } from '@/src/lib/storage';
import { getCurrentUser } from '@/src/lib/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> }
) {
  try {
    const { exportId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    // Get export record
    const exportRecord = await prisma.export.findFirst({
      where: {
        id: exportId,
        organizationId: membership.organizationId,
      },
    });

    if (!exportRecord) {
      return NextResponse.json({ error: 'Export not found' }, { status: 404 });
    }

    if (exportRecord.status !== 'READY') {
      return NextResponse.json(
        { error: 'Export not ready', status: exportRecord.status },
        { status: 400 }
      );
    }

    if (!exportRecord.storageKey) {
      return NextResponse.json(
        { error: 'Export file not found' },
        { status: 404 }
      );
    }

    // Download from storage
    const fileBuffer = await storage.download(exportRecord.storageKey);

    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'Export file not found in storage' },
        { status: 404 }
      );
    }

    // Determine content type based on format
    const contentTypeMap: Record<string, string> = {
      DATEV: 'text/csv; charset=utf-8',
      CSV: 'text/csv; charset=utf-8',
    };
    const contentType =
      contentTypeMap[exportRecord.format] ?? 'application/octet-stream';

    // Return file with appropriate headers
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${exportRecord.filename}"`,
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch (error) {
    console.error('Error downloading export:', error);
    return NextResponse.json(
      { error: 'Failed to download export' },
      { status: 500 }
    );
  }
}
