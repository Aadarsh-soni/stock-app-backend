import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.warehouse.findMany({ orderBy: { code: "asc" } });
  return Response.json(rows, { status: 200 });
}

export { POST as POST } from "./by-keys/route";