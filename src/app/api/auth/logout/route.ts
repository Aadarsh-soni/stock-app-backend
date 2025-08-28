// src/app/api/auth/logout/route.ts
export async function POST() {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "session=; Path=/; HttpOnly; SameSite=None; Max-Age=0; Secure",
      },
    });
  }