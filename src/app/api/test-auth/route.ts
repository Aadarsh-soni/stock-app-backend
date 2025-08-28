import { NextRequest, NextResponse } from "next/server";
import { signJWT, verifyJWT } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Test JWT generation
  const testPayload = { sub: "test-user-id", email: "test@example.com", role: "STAFF" };
  const token = signJWT(testPayload);
  
  // Create response with cookie
  const response = NextResponse.json({ 
    message: "Test auth", 
    token,
    original: testPayload 
  });
  
  // Set cookie manually
  response.cookies.set("session", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  
  return response;
}

export async function POST(req: NextRequest) {
  // Test reading the cookie
  const token = req.cookies.get("session")?.value;
  
  if (!token) {
    return NextResponse.json({ error: "No cookie found" }, { status: 401 });
  }
  
  const verified = verifyJWT(token);
  
  return NextResponse.json({
    hasCookie: !!token,
    tokenLength: token.length,
    verified,
    isValid: !!verified
  });
}
