import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.SaleWhereInput = {};
  if (from) where.docDate = { gte: new Date(from) };
  if (to)   where.docDate = { lte: new Date(to + "T23:59:59.999Z") };

  const sales = await prisma.sale.findMany({
    where,
    include: {
      items: {
        include: {
          product: { select: { sku: true, name: true } },
          warehouse: { select: { code: true } },
        },
      },
    },
    orderBy: [{ docDate: "desc" }, { billNo: "desc" }],
    take: 50,
  });
  return Response.json(sales);
}