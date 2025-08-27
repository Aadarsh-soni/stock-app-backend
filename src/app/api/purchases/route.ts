import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { updateAvgOnPurchase } from "@/lib/costing";

// --- Zod DTO ---
const PurchaseItemDTO = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  qty: z.number().positive(),
  unitCost: z.number().nonnegative(),
});

const PurchaseDTO = z.object({
  supplierId: z.string().uuid(),
  docDate: z.string(),             // "2025-08-26"
  invoiceNo: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(PurchaseItemDTO).min(1),
});

// replace with your real auth later; for now fake an admin ID
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
    const body = PurchaseDTO.parse(await req.json());
    const userId = await getUserId();
    if (!userId) return new Response("No admin user", { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const total = body.items.reduce((s, i) => s + i.qty * i.unitCost, 0);

      const purchase = await tx.purchase.create({
        data: {
          supplierId: body.supplierId,
          docDate: new Date(body.docDate),
          invoiceNo: body.invoiceNo,
          total,
          // notes: body.notes,  // uncomment if you added notes to model
        },
      });

      for (const it of body.items) {
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: it.productId,
            warehouseId: it.warehouseId,
            qty: new Prisma.Decimal(it.qty),
            unitCost: new Prisma.Decimal(it.unitCost),
          },
        });

        // Ledger entry
        await tx.stockTransaction.create({
          data: {
            productId: it.productId,
            warehouseId: it.warehouseId,
            type: "PURCHASE",
            qty: new Prisma.Decimal(it.qty),      // positive
            unitCost: new Prisma.Decimal(it.unitCost),
            refTable: "Purchase",
            refId: purchase.id,
            createdById: userId,
          },
        });

        // Fast stock cache
        await tx.productStock.upsert({
          where: { productId_warehouseId: { productId: it.productId, warehouseId: it.warehouseId } },
          create: {
            productId: it.productId,
            warehouseId: it.warehouseId,
            qtyOnHand: new Prisma.Decimal(it.qty),
          },
          update: {
            qtyOnHand: { increment: new Prisma.Decimal(it.qty) },
            updatedAt: new Date(),
          },
        });

        // Update avg cost
        await updateAvgOnPurchase(tx, it.productId, it.warehouseId, it.qty, it.unitCost);
      }

      return purchase;
    });

    return Response.json(result, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return new Response(JSON.stringify(e.flatten()), { status: 400 });
    }
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}

