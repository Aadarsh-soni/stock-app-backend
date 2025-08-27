import { prisma } from "@/lib/prisma";

export async function GET() {
  // Join Product + Warehouse + ProductStock
  const rows = await prisma.productStock.findMany({
    include: {
      product: { select: { sku: true, name: true, unit: true } },
      warehouse: { select: { code: true, name: true } },
    },
    orderBy: [
      { warehouse: { code: "asc" } },
      { product: { sku: "asc" } },
    ],
  });

  return Response.json(
    rows.map(r => ({
      warehouseCode: r.warehouse.code,
      warehouseName: r.warehouse.name,
      sku: r.product.sku,
      productName: r.product.name,
      unit: r.product.unit,
      qtyOnHand: Number(r.qtyOnHand),
      lastUpdated: r.updatedAt,
    }))
  );
}