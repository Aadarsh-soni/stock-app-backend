import { prisma } from "@/lib/prisma";

export async function GET() {
  const stocks = await prisma.productStock.findMany({
    include: { product: { select: { sku: true, name: true } }, warehouse: true },
  });

  const avgs = await prisma.productCostAvg.findMany();

  const key = (p: string, w: string) => `${p}|${w}`;
  const avgMap = new Map(avgs.map(a => [key(a.productId, a.warehouseId), Number(a.avgCost)]));

  const rows = stocks.map(s => {
    const avg = avgMap.get(key(s.productId, s.warehouseId)) ?? 0;
    const qty = Number(s.qtyOnHand);
    return {
      warehouseCode: s.warehouse.code,
      sku: s.product.sku,
      productName: s.product.name,
      qtyOnHand: qty,
      avgCost: avg,
      value: +(qty * avg).toFixed(2),
    };
  });

  const totalValue = rows.reduce((t, r) => t + r.value, 0);

  return Response.json({ totalValue: +totalValue.toFixed(2), rows });
}