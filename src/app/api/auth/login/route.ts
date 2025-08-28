import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { comparePassword, signJWT } from "@/lib/auth";
import { corsHeaders, noContent } from "@/lib/cors";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function OPTIONS(req: NextRequest) { 
  return noContent(req); 
}

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user?.password) {
      const headers = corsHeaders(req);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ error: "INVALID_CREDENTIALS" }), { status: 401, headers });
    }

    const ok = await comparePassword(body.password, user.password);
    if (!ok) {
      const headers = corsHeaders(req);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ error: "INVALID_CREDENTIALS" }), { status: 401, headers });
    }

    const token = signJWT({ sub: user.id, email: user.email, role: user.role });
    
    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
    
    // Set the cookie using NextResponse
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: false, // false for localhost
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    
    // Add CORS headers
    corsHeaders(req).forEach((v, k) => response.headers.set(k, v));
    
    return response;
    } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      const headers = corsHeaders(req);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ error: "VALIDATION", details: e.flatten() }), { status: 400, headers });
    }
    console.error(e);
    const headers = corsHeaders(req);
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify({ error: "SERVER_ERROR" }), { status: 500, headers });
  }
}