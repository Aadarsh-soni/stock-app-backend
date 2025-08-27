import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/reports/cogs?from=YYYY-MM-DD&to=YYYY-MM-DD
 * - Lists sale lines with Revenue, Cost (from StockTransaction.unitCost snapshot), and Profit
 * - Also returns totals
 * Notes:
 * - Filters by Sale.docDate (business date). Adjust to createdAt if you prefer.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to = searchParams.get("to");     // YYYY-MM-DD
  const format = searchParams.get("format");
  // 1) Pull all Sales (headers + items) in range
  const saleWhere: Prisma.SaleWhereInput = {};
  if (from || to) {
    const docDate: Prisma.DateTimeFilter = {};
    if (from) docDate.gte = new Date(from);
    if (to)   docDate.lte = new Date(to + "T23:59:59.999Z");
    saleWhere.docDate = docDate;
  }

  const sales = await prisma.sale.findMany({
    where: Object.keys(saleWhere).length ? saleWhere : undefined,
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

  const saleIds = sales.map(s => s.id);

  // 2) Prefetch all SALE stock transactions for these sales
  const txs = await prisma.stockTransaction.findMany({
    where: { type: "SALE", refTable: "Sale", refId: { in: saleIds } },
    select: {
      refId: true,          // saleId
      productId: true,
      warehouseId: true,
      qty: true,            // negative for sale
      unitCost: true,       // moving-average snapshot at sale time
      createdAt: true,
    },
  });

  // Map by saleId|productId|warehouseId to its cost snapshot
  const key = (saleId: string, productId: string, warehouseId: string) =>
    `${saleId}|${productId}|${warehouseId}`;

  const txMap = new Map<string, { qty: number; unitCost: number }>();
  for (const t of txs) {
    const k = key(t.refId!, t.productId, t.warehouseId);
    // If multiple tx lines existed for same item, aggregate (rare, but safe)
    const prev = txMap.get(k);
    const qty = Math.abs(Number(t.qty || 0)); // make positive
    const unitCost = Number(t.unitCost ?? 0);
    if (!prev) txMap.set(k, { qty, unitCost });
    else {
      // Weighted average if multiple ledger rows
      const totalQty = prev.qty + qty;
      const blended =
        totalQty === 0 ? unitCost : (prev.qty * prev.unitCost + qty * unitCost) / totalQty;
      txMap.set(k, { qty: totalQty, unitCost: blended });
    }
  }

  // 3) Build rows
  const rows = [];
  let totalRevenue = 0;
  let totalCost = 0;
  for (const s of sales) {
    for (const it of s.items) {
      const k = key(s.id, it.productId, it.warehouseId);
      const tx = txMap.get(k); // may be undefined if data was created before costing; treat as 0
      const qty = Number(it.qty);
      const unitPrice = Number(it.unitPrice);
      const revenue = qty * unitPrice;
      const unitCost = tx?.unitCost ?? 0;
      const cost = qty * unitCost;

      totalRevenue += revenue;
      totalCost += cost;

      rows.push({
        date: s.docDate,
        billNo: s.billNo,
        warehouseCode: it.warehouse.code,
        sku: it.product.sku,
        productName: it.product.name,
        qty,
        unitPrice,
        revenue: +revenue.toFixed(2),
        unitCost: +unitCost.toFixed(2),
        cost: +cost.toFixed(2),
        profit: +(revenue - cost).toFixed(2),
      });
    }
  }

  const totals = {
    revenue: +totalRevenue.toFixed(2),
    cost: +totalCost.toFixed(2),
    profit: +(totalRevenue - totalCost).toFixed(2),
  };


  if (format === "csv") {
    const header = [
      "date","billNo","warehouseCode","sku","productName",
      "qty","unitPrice","revenue","unitCost","cost","profit"
    ].join(",");

    const lines = rows.map(r => [
      new Date(r.date).toISOString().slice(0,10),
      r.billNo,
      r.warehouseCode,
      r.sku,
      `"${(r.productName ?? "").replace(/"/g, '""')}"`,
      r.qty,
      r.unitPrice,
      r.revenue,
      r.unitCost,
      r.cost,
      r.profit
    ].join(","));

    const csv = [header, ...lines, "", `Totals,,,,,,${totals.revenue},,${totals.cost},${totals.profit}`].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cogs_${from ?? "all"}_${to ?? "all"}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.json({ rows, totals });
}