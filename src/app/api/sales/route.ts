import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getAvgCost } from "@/lib/costing";
import { requireAuth } from "@/lib/auth";

const SaleItemDTO = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  qty: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const SaleDTO = z.object({
  customerId: z.string().uuid().optional(),
  docDate: z.string(),       // e.g. "2025-08-26"
  billNo: z.string().min(1),
  items: z.array(SaleItemDTO).min(1),
});

// Get authenticated user ID
async function getUserId(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user; // Return error response
  return user.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = SaleDTO.parse(await req.json());
    const userId = await getUserId(req);
    if (userId instanceof Response) return userId; // Return error response

    const result = await prisma.$transaction(async (tx) => {
      // Check stock for each line first
      for (const it of body.items) {
        const ps = await tx.productStock.findUnique({
          where: { productId_warehouseId: { productId: it.productId, warehouseId: it.warehouseId } },
        });
        const onHand = ps ? Number(ps.qtyOnHand) : 0;
        if (onHand < it.qty) {
          throw new Response(
            `INSUFFICIENT_STOCK for productId=${it.productId} in warehouseId=${it.warehouseId} (have ${onHand}, need ${it.qty})`,
            { status: 409 }
          ) as unknown as Error;
        }
      }

      // Create header
      const total = body.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
      const sale = await tx.sale.create({
        data: {
          customerId: body.customerId,
          docDate: new Date(body.docDate),
          billNo: body.billNo,
          total,
        },
      });

      // Post lines + ledger + stock cache
      for (const it of body.items) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: it.productId,
            warehouseId: it.warehouseId,
            qty: new Prisma.Decimal(it.qty),
            unitPrice: new Prisma.Decimal(it.unitPrice),
          },
        });

        // Note: unitCost is optional; you can plug in moving-average later.
        await tx.stockTransaction.create({
          data: {
            productId: it.productId,
            warehouseId: it.warehouseId,
            type: "SALE",
            qty: new Prisma.Decimal(-it.qty), // negative for sale
            refTable: "Sale",
            refId: sale.id,
            createdById: userId,
          },
        });

        await tx.productStock.update({
          where: { productId_warehouseId: { productId: it.productId, warehouseId: it.warehouseId } },
          data: {
            qtyOnHand: { decrement: new Prisma.Decimal(it.qty) },
            updatedAt: new Date(),
          },
        });
      }

      return sale;
    });

    return Response.json(result, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return new Response(JSON.stringify(e.flatten()), { status: 400 });
    if (e instanceof Response) return e; // thrown for insufficient stock
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}           