import { NextResponse } from "next/server";

const PUBLIC = ["/login", "/api/auth/login"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Rotas públicas passam direto
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Assets estáticos passam direto
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();

  const token   = req.cookies.get("session")?.value;
  const secret  = process.env.SESSION_SECRET;

  if (!token || !secret) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Valida HMAC: token deve ser HMAC-SHA256(secret, "authenticated")
  const valid = await verifyToken(token, secret);
  if (!valid) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("session");
    return res;
  }

  return NextResponse.next();
}

async function verifyToken(token, secret) {
  try {
    const enc     = new TextEncoder();
    const key     = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sig     = hexToBytes(token);
    const data    = enc.encode("authenticated");
    return await crypto.subtle.verify("HMAC", key, sig, data);
  } catch {
    return false;
  }
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
