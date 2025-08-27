import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
export async function POST(req: NextRequest) {
  const { code, name } = await req.json();
  if (!code || !name) return new Response("code and name required", { status: 400 });
  const wh = await prisma.warehouse.upsert({
    where: { code },
    update: { name },
    create: { code, name },
  });
  return Response.json(wh, { status: 201 });
}