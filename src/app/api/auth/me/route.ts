// src/app/api/auth/me/route.ts
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const resOrUser = await requireAuth(req);
  if (resOrUser instanceof Response) {
    // Not logged in — return null so frontend can handle it gracefully
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return Response.json({ user: resOrUser });
}