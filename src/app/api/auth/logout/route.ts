import { NextRequest } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const response = Response.json({ success: true });
  clearAuthCookie(response.headers);
  return response;
}