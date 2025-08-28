// src/lib/auth.ts
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { verifySession } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

// Name of the httpOnly cookie you set in /api/auth/login
const SESSION_COOKIE = "session";
const JWT_SECRET = process.env.JWT_SECRET!;

type Role = "ADMIN" | "STAFF";

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  name?: string | null;
};

/** Read and verify JWT from the session cookie */
export async function getSessionUser(
  req?: NextRequest
): Promise<SessionUser | null> {
  try { 
    let cookieHeader: string | undefined;

    if (req) {
      cookieHeader = req.headers.get("cookie") ?? undefined;
    } else {
      // server components / route handlers without explicit req
      const c = (await cookies()).get(SESSION_COOKIE)?.value;
      if (c) cookieHeader = `${SESSION_COOKIE}=${c}`;
    }

    if (!cookieHeader) return null;

    const match = cookieHeader
      .split(/;\s*/g)
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${SESSION_COOKIE}=`));

    if (!match) return null;

    const token = decodeURIComponent(match.split("=")[1] ?? "");
    const payload = await verifySession(token);
    if (!payload) return null;

    // (optional) ensure user still exists
    const u = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, name: true },
    });
    if (!u) return null;

    return { id: u.id, email: u.email!, role: u.role as Role, name: u.name };
  } catch {
    return null;
  }
}

/**
 * Guard: ensures there is a signed-in user and, if roles are specified,
 * that the user’s role is allowed.
 */
export async function requireAuth(
  req: NextRequest,
  opts?: { roles?: Role[] }
): Promise<Response | SessionUser> {
  const user = await getSessionUser(req);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (opts?.roles && !opts.roles.includes(user.role)) {
    return new Response("Forbidden", { status: 403 });
  }
  return user;
}     