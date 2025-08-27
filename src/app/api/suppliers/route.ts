// src/app/api/suppliers/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const rows = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return Response.json(rows);
}

// ---- create supplier (no /by-keys) ----
const SupplierDTO = z.object({
  name: z.string().min(1),
  phone: z.string().optional().default(""),
  gstin: z.string().optional().default("NA"),
  // optional external id; if you keep a unique index on extId, this lets you upsert later if needed
  extId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = SupplierDTO.parse(await req.json());

    const created = await prisma.supplier.create({
      data: {
        name: body.name,
        phone: body.phone,
        gstin: body.gstin,
      },
    });

    return Response.json(created, { status: 201 });
    } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: "Validation failed", details: e.flatten() }, { status: 400 });
    }
    if (e instanceof Error && e.message.includes("P2002")) {
      return Response.json({ error: "Supplier already exists for unique field" }, { status: 409 });
    }
    console.error(e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}