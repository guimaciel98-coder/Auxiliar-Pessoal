"use client";
import { useState, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "../Finance.module.css";
import { useFinance } from "@/hooks/useFinance";
import { fmtFin } from "@/lib/fmtFin";

export default function IncomePage() {
  const { data, loading, error, hideNumbers, refetch } = useFinance();
  const fmt = (v) => fmtFin(v, hideNumbers);
  const [toggling, setToggling] = useState(new Set());

  const [modal, setModal]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState(null);
  const [form, setForm]     = useState({ grupo: "PDV", item: "", valor: "", confirmado: false });

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.item.trim() || !form.valor || parseFloat(form.valor) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finance/ganho/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo: form.grupo, item: form.item.trim(), valor: parseFloat(form.valor), confirmado: form.confirmado }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      showToast("✓ Ganho adicionado!");
      setForm({ grupo: "PDV", item: "", valor: "", confirmado: false });
      setModal(false);
      refetch(true);
    } catch (err) {
      showToast(`⚠ ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const handleToggle = useCallback(async (item) => {
    if (toggling.has(item.item)) return;
    setToggling(p => new Set(p).add(item.item));
    try {
      const res = await fetch("/api/finance/ganho/toggle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: item.item, confirmado: !item.confirmado }),
      });
      const j = await res.json();
      if (j.ok) refetch(true);
    } finally {
      setToggling(p => { const s = new Set(p); s.delete(item.item); return s; });
    }
  }, [toggling, refetch]);

  const ganhos = data?.ganhos ?? {};

  const incomeGroups = [
    { label: "CLT",          items: ganhos.items?.clt         ?? [], total: ganhos.clt         ?? 0 },
    { label: "PDV / Freelas",items: ganhos.items?.pdv         ?? [], total: ganhos.pdv         ?? 0 },
    { label: "Outros",       items: ganhos.items?.emprestimos ?? [], total: ganhos.emprestimos ?? 0 },
  ].filter(g => g.items.length > 0);

  const grandTotal = incomeGroups.reduce((s, g) => s + g.total, 0);

  return (
    <div className={styles.container}>
      <ModuleHeader title="Ganhos" />
      <Navigation />

      {toast && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          background: "rgba(17,24,39,0.95)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#f0f0f8", padding: "10px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 600, zIndex: 999, whiteSpace: "nowrap",
        }}>{toast}</div>
      )}

      {modal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 500 }}
          onClick={() => setModal(false)}
        >
          <div
            style={{ background: "rgba(17,24,39,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px 20px 0 0", padding: "28px 20px 44px", width: "100%", maxWidth: 500 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Novo Ganho</h3>
            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Grupo</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["CLT", "PDV", "Outros"].map(g => (
                    <button key={g} type="button" onClick={() => setForm(f => ({ ...f, grupo: g }))}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s",
                        background: form.grupo === g ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${form.grupo === g ? "rgba(0,229,160,0.4)" : "rgba(255,255,255,0.1)"}`,
                        color: form.grupo === g ? "#00e5a0" : "rgba(255,255,255,0.45)" }}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Nome</label>
                <input value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} placeholder="Ex: Freela XYZ" required
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "#f0f0f8", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Valor (R$)</label>
                <input type="number" step="0.01" min="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" required
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "#f0f0f8", fontSize: 18, fontFamily: "var(--font-mono), monospace", fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.confirmado} onChange={e => setForm(f => ({ ...f, confirmado: e.target.checked }))} style={{ width: 16, height: 16, accentColor: "#10b981" }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Já recebido</span>
              </label>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setModal(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontFamily: "inherit" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !form.item || !form.valor}
                  style={{ flex: 2, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#10b981,#059669)", border: "none", cursor: "pointer", opacity: (saving || !form.item || !form.valor) ? 0.5 : 1, fontFamily: "inherit" }}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <div>
          <h1>Ganhos</h1>
          <p>{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
        </div>
      </header>

      {loading && <div className={styles.loading}>Carregando...</div>}
      {error && !loading && (
        <div className={styles.errorCard}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>⚠ Erro ao carregar</p>
          <p style={{ fontSize: 12, opacity: 0.7 }}>{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── Total de Ganhos ── */}
          <div style={{
            margin: "0 28px 28px",
            padding: "24px",
            borderRadius: 16,
            background: "rgba(16,185,129,0.06)",
            border: "1px solid rgba(16,185,129,0.18)",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.07em", color: "rgba(255,255,255,0.35)", marginBottom: 8,
            }}>
              Total de Ganhos
            </div>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 900,
              color: "#10b981", letterSpacing: "-0.03em", lineHeight: 1,
            }}>
              {fmt(grandTotal)}
            </div>
          </div>

          {/* ── Grupos de renda ── */}
          <div className={styles.content} style={{ paddingBottom: 80 }}>
            {incomeGroups.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 13 }}>
                Nenhuma fonte de renda encontrada para este mês.
              </div>
            ) : incomeGroups.map(group => (
              <div key={group.label} style={{ marginBottom: 32 }}>

                {/* Label do grupo */}
                <div style={{
                  fontSize: 13, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.09em", color: "rgba(255,255,255,0.35)", marginBottom: 14,
                }}>
                  {group.label}
                </div>

                {/* Grid 2 colunas de cards */}
                <div className={styles.incomeCardGrid}>
                  {group.items.map((item, i) => (
                    <div key={i} style={{
                      background: item.confirmado ? "rgba(255,255,255,0.03)" : "rgba(245,158,11,0.05)",
                      border: item.confirmado ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(245,158,11,0.25)",
                      borderLeft: item.confirmado ? undefined : "3px solid rgba(245,158,11,0.6)",
                      borderRadius: 16,
                      padding: 22,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}>
                      {/* Nome */}
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                        {item.item}
                      </span>

                      {/* Valor */}
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "1.9rem", fontWeight: 800,
                        color: "#10b981", letterSpacing: "-0.02em", lineHeight: 1.1,
                        margin: "6px 0 10px",
                      }}>
                        {fmt(item.valor)}
                      </span>

                      {/* Rodapé: status + botões */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                        <div
                          onClick={() => handleToggle(item)}
                          style={{
                            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 16, fontWeight: 900,
                            background: item.confirmado ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                            color:      item.confirmado ? "#10b981"                : "rgba(255,255,255,0.3)",
                            border:    `1.5px solid ${item.confirmado ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.12)"}`,
                            cursor:    toggling.has(item.item) ? "wait" : "pointer",
                            opacity:   toggling.has(item.item) ? 0.4 : 1,
                            transition: "all 0.2s",
                          }}
                        >
                          {toggling.has(item.item) ? "…" : item.confirmado ? "✓" : "○"}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{
                            fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
                            fontFamily: "inherit", background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.45)", cursor: "pointer",
                          }}>
                            Editar
                          </button>
                          <button style={{
                            fontSize: 15, lineHeight: 1, width: 28, height: 28, borderRadius: 6,
                            fontFamily: "inherit", background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.4)", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            ···
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal do grupo */}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 8, marginTop: 14 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Total {group.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 800, color: "#10b981" }}>
                    {fmt(group.total)}
                  </span>
                </div>

              </div>
            ))}

            {/* Adicionar Fonte de Renda */}
            <button onClick={() => setModal(true)} style={{
              width: "100%", padding: 14, borderRadius: 12, fontFamily: "inherit",
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 600,
              cursor: "pointer", marginTop: 4,
            }}>
              + Adicionar Fonte de Renda
            </button>
          </div>
        </>
      )}
    </div>
  );
}
