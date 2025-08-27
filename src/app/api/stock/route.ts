import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const warehouseId = searchParams.get("warehouseId");

  const where: Record<string, string> = {};
  if (productId) where.productId = productId;
  if (warehouseId) where.warehouseId = warehouseId;

  const rows = await prisma.productStock.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: { product: true, warehouse: true },
    orderBy: [{ warehouseId: "asc" }, { productId: "asc" }],
  });

  return Response.json(rows);
}