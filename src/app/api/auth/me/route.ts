// src/app/api/auth/me/route.ts
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const me = await getAuthUser(req);
  if (!me) return new Response("Unauthorized", { status: 401 });
  return Response.json({ user: me });
}