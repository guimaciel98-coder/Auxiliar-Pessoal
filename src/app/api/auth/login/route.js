import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { username, password } = await req.json();

    const expectedUser = process.env.APP_USERNAME;
    const expectedPass = process.env.APP_PASSWORD;
    const secret       = process.env.SESSION_SECRET;

    if (!expectedUser || !expectedPass || !secret) {
      return NextResponse.json({ ok: false, error: "Servidor não configurado" }, { status: 500 });
    }

    // Comparação em tempo constante (evita timing attacks)
    const userOk = username?.length === expectedUser.length &&
      crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser));
    const passOk = password?.length === expectedPass.length &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass));

    if (!userOk || !passOk) {
      await new Promise(r => setTimeout(r, 500)); // delay anti-brute-force
      return NextResponse.json({ ok: false, error: "Usuário ou senha incorretos" }, { status: 401 });
    }

    // Usa SESSION_TOKEN pré-definido (evita crypto async no middleware)
    const sessionToken = process.env.SESSION_TOKEN ?? crypto.createHmac("sha256", secret).update("authenticated").digest("hex");

    const res = NextResponse.json({ ok: true });
    res.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure:   true,
      sameSite: "strict",
      path:     "/",
      // Sem maxAge → cookie de sessão (expira ao fechar o browser)
    });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
