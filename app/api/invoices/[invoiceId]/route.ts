import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;
  return NextResponse.json({ 
    message: `Invoice ${invoiceId} - coming soon` 
  });
}

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;
  return NextResponse.json({ 
    message: `Update invoice ${invoiceId} - coming soon` 
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;
  return NextResponse.json({ 
    message: `Delete invoice ${invoiceId} - coming soon` 
  });
}
