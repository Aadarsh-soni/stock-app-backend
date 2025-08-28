import { NextRequest } from "next/server";
import { verifySession, type SessionPayload } from "./jwt";
import { prisma } from "./prisma";

// Read "session" cookie, verify JWT, (optionally) ensure user still exists.
export async function getAuthUser(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  // Optional hard check against DB (comment out if not needed)
  const exists = await prisma.user.findUnique({ where: { id: session.id } });
  if (!exists) return null;

  return session;
}

// A tiny guard for API routes
export async function requireAuth(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  return user;
}