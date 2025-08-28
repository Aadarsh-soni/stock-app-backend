
import { NextResponse, type NextRequest } from "next/server";

function parseAllowed(): string[] {
  const env = process.env.CORS_ORIGINS || "";
  return env
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function pickOrigin(req: NextRequest, allowed: string[]) {
  const origin = req.headers.get("origin") || "";
  if (allowed.includes(origin)) return origin;
  return null;
}

function corsHeaders(origin: string | null) {
  const h = new Headers();
  if (origin) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Vary", "Origin");
  }
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  h.set("Access-Control-Allow-Credentials", "false");
  h.set("Access-Control-Max-Age", "600");
  return h;
}

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const allowed = parseAllowed();
  const origin = pickOrigin(req, allowed);
  const headers = corsHeaders(origin);

  // Preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const res = NextResponse.next();
  headers.forEach((v, k) => res.headers.set(k, v));
  return res;
}

export const config = {
  matcher: "/api/:path*",
};