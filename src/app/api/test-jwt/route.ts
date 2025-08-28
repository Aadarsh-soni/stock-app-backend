import { NextRequest } from "next/server";
import { signJWT, verifyJWT } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Test JWT generation and verification
  const testPayload = { sub: "test-user-id", email: "test@example.com", role: "STAFF" };
  const token = signJWT(testPayload);
  const verified = verifyJWT(token);
  
  return Response.json({
    original: testPayload,
    token,
    verified,
    isValid: !!verified
  });
}
