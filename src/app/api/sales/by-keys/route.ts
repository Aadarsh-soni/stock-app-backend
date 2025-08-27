import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import type { Prisma as P } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format");

  const where: P.SaleWhereInput = {};
  if (from || to) {
    const docDate: P.DateTimeFilter = {};
    if (from) docDate.gte = new Date(from);
    if (to)   docDate.lte = new Date(to + "T23:59:59.999Z");
    where.docDate = docDate;
  }

  // Pull sale headers + items + product + warehouse
  const sales = await prisma.sale.findMany({
    where,
    include: {
      items: {
        include: {
          product: { select: { sku: true, name: true } },
          warehouse: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: [{ docDate: "asc" }, { billNo: "asc" }],
  });

  if (sales.length === 0) {
    return Response.json({ rows: [], totals: { revenue: 0, cost: 0, profit: 0 } });
  }

  // Prefetch SALE ledger for unitCost snapshots
  const saleIds = sales.map(s => s.id);
  const txs = await prisma.stockTransaction.findMany({
    where: { type: "SALE", refTable: "Sale", refId: { in: saleIds } },
    select: { refId: true, productId: true, warehouseId: true, unitCost: true, qty: true },
  });

  const key = (saleId: string, productId: string, warehouseId: string) => `${saleId}|${productId}|${warehouseId}`;
  const costSnap = new Map<string, number>();

  for (const t of txs) {
    const k = key(t.refId!, t.productId, t.warehouseId);
    // if multiple rows, average by qty
    const prev = costSnap.get(k);
    const unitCost = Number(t.unitCost ?? 0);
    if (prev == null) costSnap.set(k, unitCost);
    else costSnap.set(k, (prev + unitCost) / 2); // simple blend; COGS route already does weighted
  }

  const rows: Array<{
    date: Date;
    billNo: string | null;
    warehouseCode: string | null;
    sku: string | null;
    productName: string | null;
    qty: number;
    unitPrice: number | null;
    unitCost: number | null;
    revenue: number | null;
    cost: number;
    profit: number;
  }> = [];

  let revenueSum = 0;
  let costSum = 0;

  for (const s of sales) {
    for (const it of s.items) {
      const k = key(s.id, it.productId, it.warehouseId);
      const unitCost = costSnap.get(k) ?? 0;
      const qty = Number(it.qty);
      const unitPrice = Number(it.unitPrice);
      const revenue = qty * unitPrice;
      const cost = qty * unitCost;

      revenueSum += revenue;
      costSum += cost;

      rows.push({
        date: s.docDate,
        billNo: s.billNo,
        warehouseCode: it.warehouse.code,
        sku: it.product.sku,
        productName: it.product.name,
        qty,
        unitPrice,
        unitCost: +unitCost.toFixed(2),
        revenue: +revenue.toFixed(2),
        cost: +cost.toFixed(2),
        profit: +(revenue - cost).toFixed(2),
      });
    }
  }

  const totals = {
    revenue: +revenueSum.toFixed(2),
    cost: +costSum.toFixed(2),
    profit: +(revenueSum - costSum).toFixed(2),
  };

  if (format === "csv") {
    const header = "date,billNo,warehouseCode,sku,productName,qty,unitPrice,unitCost,revenue,cost,profit";
    const lines = rows.map(r => [
      new Date(r.date).toISOString().slice(0,10),
      r.billNo,
      r.warehouseCode,
      r.sku,
      `"${(r.productName ?? "").replace(/"/g,'""')}"`,
      r.qty,
      r.unitPrice,
      r.unitCost,
      r.revenue,
      r.cost,
      r.profit
    ].join(","));
    const csv = [header, ...lines, "", `Totals,,,,,,${totals.revenue},${totals.cost},${totals.profit}`].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sales_${from ?? "all"}_${to ?? "all"}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.json({ rows, totals });
}