import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    address: s.address,
  });
}
