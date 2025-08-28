// src/app/api/auth/login/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { verify } from "@/lib/hash";
import { signSession } from "@/lib/jwt";

const LoginDTO = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const isProd = process.env.NODE_ENV === "production";
function cookieHeader(token: string) {
  return [
    `session=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=None",
    isProd ? "Secure" : "",
    `Max-Age=${60 * 60 * 8}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = LoginDTO.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return new Response("Invalid email or password", { status: 401 });
    }

    const ok = await verify(password, user.password);
    if (!ok) return new Response("Invalid email or password", { status: 401 });

    const token = await signSession({
      id: user.id,
      email: user.email!,
      role: user.role,
    });

    return new Response(
      JSON.stringify({ ok: true, user: { id: user.id, email: user.email, role: user.role } }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookieHeader(token),
        },
      }
    );
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}