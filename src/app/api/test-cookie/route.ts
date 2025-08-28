import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const response = new Response(JSON.stringify({ message: "Cookie test" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "test=value; Path=/; HttpOnly"
    }
  });
  
  return response;
}
