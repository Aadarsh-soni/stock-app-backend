// src/lib/auth.ts
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/** ====== ENV / CONSTANTS ====== */
export const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME || "session";

const JWT_SECRET =
  process.env.JWT_SECRET || "dev_only_change_this_secret";
const COOKIE_DOMAIN =
  process.env.COOKIE_DOMAIN || undefined; // e.g. ".yourdomain.com"

/** ====== PASSWORD UTILS ====== */
export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/** ====== JWT (HS256) MINIMAL ====== */
type JWTPayload = {
  sub: string; // user id
  email?: string | null;
  role?: string | null;
  exp?: number; // seconds since epoch
};

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signHS256(data: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function signJWT(
  payload: Omit<JWTPayload, "exp">,
  expiresInSeconds = 60 * 60 * 24 * 7 // 7 days
) {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = { ...payload, exp };

  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(body));
  const toSign = `${h}.${p}`;
  const sig = signHS256(toSign, JWT_SECRET);
  return `${toSign}.${sig}`;
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const expected = signHS256(`${h}.${p}`, JWT_SECRET);
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(p, "base64url").toString()) as JWTPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** ====== COOKIE HELPERS ====== */
type CookieOpts = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number; // seconds
  domain?: string;
};

function serializeCookie(name: string, value: string, opts: CookieOpts = {}) {
  const parts = [`${name}=${value}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.domain ?? COOKIE_DOMAIN) parts.push(`Domain=${opts.domain ?? COOKIE_DOMAIN}`);
  parts.push(`SameSite=${opts.sameSite ?? "lax"}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure ?? true) parts.push("Secure");
  return parts.join("; ");
}

export function setAuthCookie(headers: Headers, token: string) {
  headers.append(
    "Set-Cookie",
    serializeCookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
  );
}

export function clearAuthCookie(headers: Headers) {
  headers.append(
    "Set-Cookie",
    serializeCookie(AUTH_COOKIE_NAME, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  );
}

/** ====== AUTH GUARDS ====== */
export async function requireAuth(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = verifyJWT(token);
  if (!payload?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Load minimal user fields (adjust as needed)
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  return user; // { id, email, name, role }
}

/**
 * Convenience helper for routes that previously used `getAuthUser`.
 * Returns `null` if unauthenticated, or the user object if authenticated.
 */
export async function getAuthUser(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyJWT(token);
  if (!payload?.sub) return null;

  // Load minimal user fields (adjust as needed)
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true },
  });

  return user; // { id, email, name, role } or null
}