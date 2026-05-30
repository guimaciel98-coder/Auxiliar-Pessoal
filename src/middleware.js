import { NextResponse } from "next/server";

// Cache do token por cold start — importKey só ocorre uma vez
let _tokenCache = null;
async function getExpectedToken() {
  if (_tokenCache) return _tokenCache;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("authenticated"));
  _tokenCache = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return _tokenCache;
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Passa direto: assets, API (têm auth própria) e rota de login
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/login")
  ) {
    return NextResponse.next();
  }

  const token    = req.cookies.get("session")?.value;
  const expected = await getExpectedToken();

  if (!token || !expected || token !== expected) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Só intercepta rotas de página — exclui estáticos, API e _next
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
