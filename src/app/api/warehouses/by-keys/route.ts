import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Body = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const { code, name } = Body.parse(json);

  const wh = await prisma.warehouse.upsert({
    where: { code },
    update: { name },
    create: { code, name },
  });

  return Response.json(wh, { status: 201 });
}

export async function GET() {
  const rows = await prisma.warehouse.findMany({
    orderBy: { code: "asc" },
  });
  return Response.json(rows);
}