import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Uploads API - coming soon" });
}

export async function POST() {
  return NextResponse.json({ message: "Create upload - coming soon" }, { status: 201 });
}
