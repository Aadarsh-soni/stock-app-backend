import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { okJson, noContent } from "@/lib/cors";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1)
});

export async function OPTIONS(req: NextRequest) {
  return noContent(req);
}

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) return okJson(req, { error: "EMAIL_TAKEN" }, { status: 409 });

    const pwd = await hashPassword(body.password);
    const u = await prisma.user.create({
      data: { email: body.email, name: body.name, password: pwd, role: "STAFF" }
    });

    return okJson(req, { id: u.id, email: u.email, name: u.name }, { status: 201 });
    } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return okJson(req, { error: "VALIDATION", details: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return okJson(req, { error: "SERVER_ERROR" }, { status: 500 });
  }
}