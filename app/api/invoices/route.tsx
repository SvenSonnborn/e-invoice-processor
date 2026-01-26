import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Invoices API - coming soon" });
}

export async function POST() {
  return NextResponse.json({ message: "Create invoice - coming soon" }, { status: 201 });
}
