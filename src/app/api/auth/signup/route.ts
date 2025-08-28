import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { hash } from "@/lib/hash";

const SignupDTO = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
        const body = SignupDTO.parse(await req.json());

    // Check if already exists
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) return new Response("Email already registered", { status: 409 });

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name ?? null,
        role: "STAFF",
        password: await hash(body.password),
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return Response.json(user, { status: 201 });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}