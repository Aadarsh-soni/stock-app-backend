import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

const Body = z.object({
  sku: z.string().min(1),
  fromCode: z.string().min(1),
  toCode: z.string().min(1),
  qty: z.number().positive(),
});

// Get authenticated user ID
async function getUserId(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user; // Return error response
  return user.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    if (body.fromCode === body.toCode) return new Response("fromCode and toCode cannot be same", { status: 400 });
    const userId = await getUserId(req);
    if (userId instanceof Response) return userId; // Return error response

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { sku: body.sku } });
      if (!product) throw new Response(`PRODUCT_NOT_FOUND:${body.sku}`, { status: 400 }) as unknown as Error;
      const fromWh = await tx.warehouse.findUnique({ where: { code: body.fromCode } });
      if (!fromWh) throw new Response(`WAREHOUSE_NOT_FOUND:${body.fromCode}`, { status: 400 }) as unknown as Error;
      const toWh = await tx.warehouse.findUnique({ where: { code: body.toCode } });
      if (!toWh) throw new Response(`WAREHOUSE_NOT_FOUND:${body.toCode}`, { status: 400 }) as unknown as Error;

      const ps = await tx.productStock.findUnique({
        where: { productId_warehouseId: { productId: product.id, warehouseId: fromWh.id } },
      });
      const onHand = ps ? Number(ps.qtyOnHand) : 0;
      if (onHand < body.qty) {
        throw new Response(`INSUFFICIENT_STOCK at ${body.fromCode} (have ${onHand}, need ${body.qty})`, { status: 409 }) as unknown as Error;
      }

      await tx.stockTransaction.create({
        data: { productId: product.id, warehouseId: fromWh.id, type: "TRANSFER_OUT", qty: new Prisma.Decimal(-body.qty), createdById: userId },
      });
      await tx.productStock.update({
        where: { productId_warehouseId: { productId: product.id, warehouseId: fromWh.id } },
        data: { qtyOnHand: { decrement: new Prisma.Decimal(body.qty) }, updatedAt: new Date() },
      });

      await tx.stockTransaction.create({
        data: { productId: product.id, warehouseId: toWh.id, type: "TRANSFER_IN", qty: new Prisma.Decimal(body.qty), createdById: userId },
      });
      await tx.productStock.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId: toWh.id } },
        create: { productId: product.id, warehouseId: toWh.id, qtyOnHand: new Prisma.Decimal(body.qty) },
        update: { qtyOnHand: { increment: new Prisma.Decimal(body.qty) }, updatedAt: new Date() },
      });
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    if (e instanceof z.ZodError) return new Response(JSON.stringify(e.flatten()), { status: 400 });
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}