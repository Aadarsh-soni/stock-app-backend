// src/app/api/products/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const ProductCreate = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  unit: z.string().min(1).default("pcs"),
  cost: z.number().nonnegative().default(0),
  price: z.number().nonnegative().default(0),
  reorderLevel: z.number().int().nonnegative().default(0),
});

export async function GET() {
  const rows = await prisma.product.findMany({ orderBy: { sku: "asc" } });
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  try {
    const parsed = ProductCreate.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify(parsed.error.flatten()), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const b = parsed.data;

    // Create product
    const created = await prisma.product.create({
      data: {
        name: b.name,
        sku: b.sku,
        unit: b.unit,
        cost: new Prisma.Decimal(b.cost),   // safe for Decimal columns
        price: new Prisma.Decimal(b.price),
        reorderLevel: b.reorderLevel,
      },
    });

    // Optional: also create ProductStock row at 0 for MAIN if present
    const mainWh = await prisma.warehouse.findUnique({ where: { code: "MAIN" } });
    if (mainWh) {
      await prisma.productStock.upsert({
        where: { productId_warehouseId: { productId: created.id, warehouseId: mainWh.id } },
        create: { productId: created.id, warehouseId: mainWh.id, qtyOnHand: new Prisma.Decimal(0) },
        update: {},
      });
    }

    return new Response(JSON.stringify(created), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (err: unknown) {
    // Prisma typed errors
    if (err && typeof err === "object" && "code" in (err as { code: string; meta?: unknown; message?: string })) {
      const e = err as { code: string; meta?: unknown; message?: string };
      // Unique constraint (e.g., duplicate SKU)
      if (e.code === "P2002") {
        return new Response(
          JSON.stringify({
            error: "Duplicate value",
            meta: e.meta,
            hint: "SKU must be unique",
          }),
          { status: 409, headers: { "content-type": "application/json" } }
        );
      }
    }

    console.error("POST /api/products error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
} 