// src/app/api/auth/me/route.ts
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  return Response.json({ user });
}