"use client";
// Tela de login — minimalista, na identidade do app (mesmo título com data do Hub, cores dos 4 módulos).
import { useState } from "react";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/ui/BrandMark";
import s from "./Login.module.css";

const DIAS  = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

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

  const now  = new Date();
  const hora = now.getHours();
  const saud = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className={s.wrap}>
      <div className={s.glow} aria-hidden />
      <main className={s.box}>
        {/* Ícone com aro nas cores dos módulos */}
        <div className={s.mark}>
          <span className={s.ring} aria-hidden />
          <span className={s.markInner}><BrandMark size={30} /></span>
        </div>

        <p className={s.hello}>{saud}</p>
        <h1 className={s.title}><b>{DIAS[now.getDay()]}</b>, {now.getDate()} de {MESES[now.getMonth()]}</h1>

        <form onSubmit={handleSubmit} className={s.form}>
          <div className={`${s.group} ${error ? s.groupErr : ""}`}>
            <input className={s.input} type="text" placeholder="Usuário" autoComplete="username" required autoFocus
              value={form.username} onChange={e => { setError(""); setForm(f => ({ ...f, username: e.target.value })); }} />
            <div className={s.sep} />
            <div className={s.passRow}>
              <input className={s.input} type={show ? "text" : "password"} placeholder="Senha" autoComplete="current-password" required
                value={form.password} onChange={e => { setError(""); setForm(f => ({ ...f, password: e.target.value })); }} />
              <button type="button" onClick={() => setShow(v => !v)} className={s.eye} title={show ? "Ocultar senha" : "Mostrar senha"}>
                {show ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/></svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {error && <p className={s.error}>{error}</p>}

          <button type="submit" disabled={loading} className={s.submit}>
            <span>{loading ? "Entrando…" : "Entrar"}</span>
            {!loading && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>}
          </button>
        </form>

        <div className={s.foot}>
          <span><i style={{ background: "#a78bfa" }} />Tarefas</span>
          <span><i style={{ background: "#34d399" }} />Finanças</span>
          <span><i style={{ background: "#38bdf8" }} />Rotina</span>
          <span><i style={{ background: "#fb7185" }} />Saúde</span>
        </div>
      </main>
    </div>
  );
}
