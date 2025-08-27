import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return Response.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: false, error: "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}