import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const rows = await prisma.product.findMany({ orderBy: { sku: "asc" } });
  return Response.json(rows);
}

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1).default("pcs"),
  cost: z.number().nonnegative().default(0),
  price: z.number().nonnegative().default(0),
  reorderLevel: z.number().int().nonnegative().default(0),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const body = productSchema.parse(json);

    const created = await prisma.product.create({
      data: {
        sku: body.sku,
        name: body.name,
        unit: body.unit,
        cost: body.cost,
        price: body.price,
        reorderLevel: body.reorderLevel,
      },
    });

    return Response.json(created, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("P2002")) {
      return Response.json(
        { error: "SKU already exists" },
        { status: 409 }
      );
    }
    if (e instanceof z.ZodError) {
      return Response.json(
        { error: "Validation failed", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error(e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}