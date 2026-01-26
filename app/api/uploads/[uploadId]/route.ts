import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const { uploadId } = await params;
  return NextResponse.json({ 
    message: `Upload ${uploadId} - coming soon` 
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const { uploadId } = await params;
  return NextResponse.json({ 
    message: `Delete upload ${uploadId} - coming soon` 
  });
}
