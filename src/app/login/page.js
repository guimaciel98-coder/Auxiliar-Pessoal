"use client";
// Tela de login — mesma identidade visual do app (fundo escuro, brilhos dos 4 módulos, botão branco).
import { useState } from "react";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/ui/BrandMark";
import s from "./Login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm]       = useState({ username: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow]       = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) {
        router.replace("/");
        router.refresh();
      } else {
        setError(j.error ?? "Credenciais inválidas");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  const hora  = new Date().getHours();
  const saud  = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className={s.wrap}>
      <div className={s.glow} aria-hidden />
      <div className={s.card}>
        <div className={s.brand}>
          <span className={s.logo}><BrandMark size={34} /></span>
          <div>
            <b>Daily</b>
            <span>Tarefas · Finanças · Rotina · Saúde</span>
          </div>
        </div>

        <h1 className={s.title}>{saud}.</h1>
        <p className={s.sub}>Entre para ver o seu dia.</p>

        <form onSubmit={handleSubmit} className={s.form}>
          <label className={s.field}>
            <span>Usuário</span>
            <input type="text" autoComplete="username" required autoFocus
              value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </label>
          <label className={s.field}>
            <span>Senha</span>
            <div className={s.pass}>
              <input type={show ? "text" : "password"} autoComplete="current-password" required
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              <button type="button" onClick={() => setShow(v => !v)} className={s.eye}>{show ? "ocultar" : "mostrar"}</button>
            </div>
          </label>

          {error && <div className={s.error}>{error}</div>}

          <button type="submit" disabled={loading} className={s.submit}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className={s.dots} aria-hidden>
          <i style={{ background: "#a78bfa" }} /><i style={{ background: "#34d399" }} /><i style={{ background: "#38bdf8" }} /><i style={{ background: "#fb7185" }} />
        </div>
      </div>
    </div>
  );
}
