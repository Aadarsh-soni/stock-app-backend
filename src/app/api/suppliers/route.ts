import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return Response.json(rows);
}