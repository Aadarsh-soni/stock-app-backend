import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { email: "admin@example.com", name: "Admin", role: "ADMIN", password: "changeme" },
  });

  const wh = await prisma.warehouse.upsert({
    where: { code: "MAIN" },
    update: {},
    create: { code: "MAIN", name: "Main Warehouse" },
  });

  const supplier = await prisma.supplier.upsert({
    where: { id: "Default Supplier" },
    update: {},
    create: { name: "Default Supplier", phone: "0000000000", gstin: "NA" },
  });

  const product = await prisma.product.upsert({
    where: { sku: "SKU-001" },
    update: {},
    create: { name: "Demo Pen", sku: "SKU-001", unit: "pcs", cost: 10, price: 15, reorderLevel: 20 },
  });

  await prisma.productStock.upsert({
    where: { productId_warehouseId: { productId: product.id, warehouseId: wh.id } },
    update: {},
    create: { productId: product.id, warehouseId: wh.id, qtyOnHand: 0 },
  });

  return Response.json({
    message: "Bootstrap OK",
    adminId: admin.id,
    warehouseId: wh.id,
    supplierId: supplier.id,
    productId: product.id,
  });
}