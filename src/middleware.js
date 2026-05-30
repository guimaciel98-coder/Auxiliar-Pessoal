import { NextResponse } from "next/server";

// Middleware 100% síncrono — sem async, sem crypto, só comparação de string.
// SESSION_TOKEN é pré-computado como env var para evitar qualquer latência.
export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Deixa passar: login, API (auth própria), assets Next.js
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const cookie   = req.cookies.get("session")?.value;
  const expected = process.env.SESSION_TOKEN;

  if (!cookie || !expected || cookie !== expected) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
