import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/src/lib/auth/session';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const authResult = await requireApiAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { uploadId } = await params;
  return NextResponse.json({
    message: `Upload ${uploadId} - coming soon`,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const authResult = await requireApiAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { uploadId } = await params;
  return NextResponse.json({
    message: `Delete upload ${uploadId} - coming soon`,
  });
}
