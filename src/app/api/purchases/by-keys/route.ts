import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

const Body = z.object({
  supplierName: z.string().min(1),
  docDate: z.string(),
  invoiceNo: z.string().min(1),
  items: z.array(z.object({
    sku: z.string().min(1),
    warehouseCode: z.string().min(1),
    qty: z.number().positive(),
    unitCost: z.number().nonnegative(),
  })).min(1),
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
    const userId = await getUserId(req);
    if (userId instanceof Response) return userId; // Return error response
    if (!userId) return new Response("No admin user", { status: 400 });

    const supplier = await prisma.supplier.findFirst({ where: { name: body.supplierName } });
    if (!supplier) return new Response("Supplier not found", { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const resolved = await Promise.all(body.items.map(async (it) => {
        const product = await tx.product.findUnique({ where: { sku: it.sku } });
        if (!product) throw new Error(`PRODUCT_NOT_FOUND:${it.sku}`);
        const wh = await tx.warehouse.findUnique({ where: { code: it.warehouseCode } });
        if (!wh) throw new Error(`WAREHOUSE_NOT_FOUND:${it.warehouseCode}`);
        return { productId: product.id, warehouseId: wh.id, ...it };
      }));

      const total = resolved.reduce((s, i) => s + i.qty * i.unitCost, 0);

      const purchase = await tx.purchase.create({
        data: {
          supplierId: supplier.id,
          docDate: new Date(body.docDate),
          invoiceNo: body.invoiceNo,
          total,
        },
      });

      for (const it of resolved) {
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: it.productId,
            warehouseId: it.warehouseId,
            qty: new Prisma.Decimal(it.qty),
            unitCost: new Prisma.Decimal(it.unitCost),
          },
        });

        await tx.stockTransaction.create({
          data: {
            productId: it.productId,
            warehouseId: it.warehouseId,
            type: "PURCHASE",
            qty: new Prisma.Decimal(it.qty),
            unitCost: new Prisma.Decimal(it.unitCost),
            refTable: "Purchase",
            refId: purchase.id,
            createdById: userId,
          },
        });

        await tx.productStock.upsert({
          where: { productId_warehouseId: { productId: it.productId, warehouseId: it.warehouseId } },
          create: { productId: it.productId, warehouseId: it.warehouseId, qtyOnHand: new Prisma.Decimal(it.qty) },
          update: { qtyOnHand: { increment: new Prisma.Decimal(it.qty) }, updatedAt: new Date() },
        });
      }

      return purchase;
    });

    return Response.json(result, { status: 201 });
    } catch (e: unknown) {
    if (e instanceof z.ZodError) return new Response(JSON.stringify(e.flatten()), { status: 400 });
    if (typeof e === "object" && e !== null && "message" in e && typeof e.message === "string" && e.message.startsWith("PRODUCT_NOT_FOUND"))
      return new Response(e.message, { status: 400 });
    if (typeof e === "object" && e !== null && "message" in e && typeof e.message === "string" && e.message.startsWith("WAREHOUSE_NOT_FOUND"))
      return new Response(e.message, { status: 400 });
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}