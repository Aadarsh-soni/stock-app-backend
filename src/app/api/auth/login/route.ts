import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { compare } from "bcryptjs";
import { okJson, noContent } from "@/lib/cors";
import { signSession } from "@/lib/jwt";

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
    if (!user?.password) return okJson(req, { error: "INVALID_CREDENTIALS" }, { status: 401 });

      const ok = await compare(body.password, user.password);
    if (!ok) return okJson(req, { error: "INVALID_CREDENTIALS" }, { status: 401 });

    const token = await signSession({ id: user.id, email: user.email!, role: user.role });  
    return okJson(req, { token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return okJson(req, { error: "VALIDATION", details: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return okJson(req, { error: "SERVER_ERROR" }, { status: 500 });
  }
}