import { NextResponse } from "next/server";

const PUBLIC = ["/login", "/api/auth/login", "/api/auth/logout"];

// Calcula o token esperado uma vez por cold start — evita importKey em todo request
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

  // Assets e rotas públicas passam direto sem nenhuma lógica
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const token    = req.cookies.get("session")?.value;
  const expected = await getExpectedToken();

  if (!token || !expected || token !== expected) {
    // RSC prefetch requests devem retornar 401, não redirect (evita loop no client)
    const isRSC = req.headers.get("RSC") === "1" || req.nextUrl.searchParams.has("_rsc");
    if (isRSC) {
      return new NextResponse(null, { status: 401 });
    }
    const res = NextResponse.redirect(new URL("/login", req.url));
    if (token) res.cookies.delete("session");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
