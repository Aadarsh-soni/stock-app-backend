import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

const AdjustmentDTO = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  qty: z.number(),            // can be negative
  reason: z.string().min(1),
});

// Get authenticated user ID
async function getUserId(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user; // Return error response
  return user.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = AdjustmentDTO.parse(await req.json());
    const userId = await getUserId(req);
    if (userId instanceof Response) return userId; // Return error response

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