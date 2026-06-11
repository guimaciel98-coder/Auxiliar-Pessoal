import { NextResponse } from "next/server";

// Middleware 100% síncrono — sem async, sem crypto, só comparação de string.
// SESSION_TOKEN é pré-computado como env var para evitar qualquer latência.
export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Deixa passar sem checagem: login, rotas de autenticação própria, assets Next.js
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const cookie   = req.cookies.get("session")?.value;
  const expected = process.env.SESSION_TOKEN;
  const authed   = cookie && expected && cookie === expected;

  if (authed) {
    return NextResponse.next();
  }

  // Rotas de API: sem sessão válida, responde 401 em vez de redirecionar (não há HTML pra redirecionar)
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
