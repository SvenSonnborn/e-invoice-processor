import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Exports API - coming soon" });
}

export async function POST() {
  return NextResponse.json({ message: "Create export - coming soon" }, { status: 201 });
}
