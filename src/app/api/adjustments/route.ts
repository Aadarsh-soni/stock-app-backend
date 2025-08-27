import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const AdjustmentDTO = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  qty: z.number(),            // can be negative
  reason: z.string().min(1),
});

async function getUserId() {
  const email = "admin@example.com";
  let u = await prisma.user.findUnique({ where: { email } });
  if (!u) {
    u = await prisma.user.create({
      data: { email, name: "Admin", role: "ADMIN", password: "changeme" },
    });
  }
  return u.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = AdjustmentDTO.parse(await req.json());
    const userId = await getUserId();

    await prisma.$transaction(async (tx) => {
      // If negative, ensure we don't go below zero (optional business rule)
      if (body.qty < 0) {
        const ps = await tx.productStock.findUnique({
          where: { productId_warehouseId: { productId: body.productId, warehouseId: body.warehouseId } },
        });
        const onHand = ps ? Number(ps.qtyOnHand) : 0;
        if (onHand < Math.abs(body.qty)) {
          throw new Response(`INSUFFICIENT_STOCK for adjustment (have ${onHand}, need ${Math.abs(body.qty)})`, {
            status: 409,
          }) as unknown as Error;
        }
      }

      await tx.stockTransaction.create({
        data: {
          productId: body.productId,
          warehouseId: body.warehouseId,
          type: "ADJUSTMENT",
          qty: new Prisma.Decimal(body.qty),
          reason: body.reason,
          createdById: userId,
        },
      });

      await tx.productStock.upsert({
        where: { productId_warehouseId: { productId: body.productId, warehouseId: body.warehouseId } },
        create: { productId: body.productId, warehouseId: body.warehouseId, qtyOnHand: new Prisma.Decimal(body.qty) },
        update: { qtyOnHand: { increment: new Prisma.Decimal(body.qty) }, updatedAt: new Date() },
      });
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return new Response(JSON.stringify(e.flatten()), { status: 400 });
    if (e instanceof Response) return e;
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}