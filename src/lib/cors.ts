
import { NextRequest, NextResponse } from "next/server";

const ALLOWED = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// include localhost ports you use during dev
const DEFAULTS = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];

function pickOrigin(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  if ([...ALLOWED, ...DEFAULTS].includes(origin)) return origin;
  return ""; // disallow unknown origins
}

export function corsHeaders(req: NextRequest) {
  const origin = pickOrigin(req);
  const h = new Headers();
  if (origin) h.set("Access-Control-Allow-Origin", origin);
  // Allow cookies across origins
  h.set("Access-Control-Allow-Credentials", "true");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  return h;
}

export function corsPreflight(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function withCors(req: NextRequest, res: NextResponse) {
  const h = corsHeaders(req);
  h.forEach((v, k) => res.headers.set(k, v));
  return res;
}