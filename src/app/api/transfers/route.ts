import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

const Body = z.object({
  productId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
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

    if (body.fromWarehouseId === body.toWarehouseId) {
      return new Response("fromWarehouseId and toWarehouseId cannot be same", { status: 400 });
    }

    const userId = await getUserId(req);
    if (userId instanceof Response) return userId; // Return error response

    await prisma.$transaction(async (tx) => {
      // check available stock at source
      const ps = await tx.productStock.findUnique({
        where: {
          productId_warehouseId: {
            productId: body.productId,
            warehouseId: body.fromWarehouseId,
          },
        },
      });
      const onHand = ps ? Number(ps.qtyOnHand) : 0;
      if (onHand < body.qty) {
        throw new Error(`INSUFFICIENT_STOCK: have ${onHand}, need ${body.qty}`);
      }

      // OUT from source
      await tx.stockTransaction.create({
        data: {
          productId: body.productId,
          warehouseId: body.fromWarehouseId,
          type: "TRANSFER_OUT",
          qty: new Prisma.Decimal(-body.qty),
          createdById: userId,
        },
      });
      await tx.productStock.update({
        where: {
          productId_warehouseId: {
            productId: body.productId,
            warehouseId: body.fromWarehouseId,
          },
        },
        data: {
          qtyOnHand: { decrement: new Prisma.Decimal(body.qty) },
          updatedAt: new Date(),
        },
      });

      // IN to destination
      await tx.stockTransaction.create({
        data: {
          productId: body.productId,
          warehouseId: body.toWarehouseId,
          type: "TRANSFER_IN",
          qty: new Prisma.Decimal(body.qty),
          createdById: userId,
        },
      });
      await tx.productStock.upsert({
        where: {
          productId_warehouseId: {
            productId: body.productId,
            warehouseId: body.toWarehouseId,
          },
        },
        create: {
          productId: body.productId,
          warehouseId: body.toWarehouseId,
          qtyOnHand: new Prisma.Decimal(body.qty),
        },
        update: {
          qtyOnHand: { increment: new Prisma.Decimal(body.qty) },
          updatedAt: new Date(),
        },
      });
    }); 

    return Response.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return new Response(JSON.stringify(e.flatten()), { status: 400 });
    }
    if (e instanceof Error && e.message.startsWith("INSUFFICIENT_STOCK")) {
      return new Response(e.message, { status: 409 });
    }
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}