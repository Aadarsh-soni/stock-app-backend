// src/lib/cors.ts
import { NextRequest } from "next/server";

const ALLOW_HEADERS =
  "Origin, Content-Type, Accept, Authorization, X-Requested-With";

function allowedOrigins(): string[] {
  const v = process.env.CORS_ORIGINS?.split(",").map(s => s.trim()).filter(Boolean) || [];
  return v;
}

function pickOrigin(req: NextRequest): string {
  const origin = req.headers.get("origin") || "";
  const allow = allowedOrigins();
  if (allow.length === 0) return "*";
  if (allow.includes(origin)) return origin;       // echo allowed origin
  return allow[0];                                 // fall back to first allowed
}

export function corsHeaders(req: NextRequest): Headers {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", pickOrigin(req));
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Credentials", "true");
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  h.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
  return h;
}

export function okJson(req: NextRequest, data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  corsHeaders(req).forEach((v, k) => headers.set(k, v));
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function noContent(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}