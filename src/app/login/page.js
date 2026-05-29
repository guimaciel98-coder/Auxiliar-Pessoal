"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm]     = useState({ username: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-primary, #0a0d14)",
    }}>
      <div style={{
        width: "100%", maxWidth: 360, padding: "40px 32px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
      }}>
        {/* Logo / título */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚡</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", margin: 0 }}>Daily App</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Faça login para continuar</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
              Usuário
            </label>
            <input
              type="text" autoComplete="username" required
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "11px 14px", color: "#f0f0f8", fontSize: 14,
                fontFamily: "inherit", outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
              Senha
            </label>
            <input
              type="password" autoComplete="current-password" required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "11px 14px", color: "#f0f0f8", fontSize: 14,
                fontFamily: "inherit", outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: "#ef4444", background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "9px 12px",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 4, padding: "13px 0", borderRadius: 10, border: "none",
              fontSize: 14, fontWeight: 700, color: "#fff",
              background: loading ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg,#6366f1,#4f46e5)",
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
