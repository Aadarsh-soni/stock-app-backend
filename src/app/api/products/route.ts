import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json(products);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // minimal validation just for smoke-test
  const created = await prisma.product.create({
    data: {
      name: body.name,
      sku: body.sku,
      unit: body.unit ?? "pcs",
      cost: body.cost ?? 0,
      price: body.price ?? 0,
      reorderLevel: body.reorderLevel ?? 0,
    },
  });
  // also create initial ProductStock row at 0 for MAIN warehouse later
  return Response.json(created, { status: 201 });
}