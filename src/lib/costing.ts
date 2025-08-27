// src/lib/costing.ts
import { Prisma } from "@prisma/client";

export async function getAvgCost(
  tx: Prisma.TransactionClient,
  productId: string,
  warehouseId: string
) {
  const row = await tx.productCostAvg.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  return row ? Number(row.avgCost) : 0;
}

export async function updateAvgOnPurchase(
  tx: Prisma.TransactionClient, 
  productId: string,
  warehouseId: string,
  purchaseQty: number,
  unitCost: number
) {
  const ps = await tx.productStock.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  const oldQty = ps ? Number(ps.qtyOnHand) : 0;

  const prev = await tx.productCostAvg.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  const oldAvg = prev ? Number(prev.avgCost) : 0;

  const newAvg =
    oldQty + purchaseQty === 0
      ? unitCost
      : (oldQty * oldAvg + purchaseQty * unitCost) / (oldQty + purchaseQty);

  await tx.productCostAvg.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    create: {
      productId,
      warehouseId,
      avgCost: new Prisma.Decimal(newAvg),
    },
    update: {
      avgCost: new Prisma.Decimal(newAvg),
      updatedAt: new Date(),
    },
  });

  return newAvg;
}