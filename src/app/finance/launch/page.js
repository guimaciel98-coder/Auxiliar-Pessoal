"use client";
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import finStyles from "../Finance.module.css";
import { useFinance } from "@/hooks/useFinance";
import { fmtFin } from "@/lib/fmtFin";
import FinanceOcultarBtn from "@/components/ui/FinanceOcultarBtn";

// ── Formatadores ──────────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10); }

const MES_PT_FULL = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
function cicloAtualLabel(melhorDia) {
  if (!melhorDia) return null;
  const now   = new Date();
  const today = now.getDate();
  const mIdx  = today < melhorDia ? now.getMonth() : now.getMonth() + 1;
  const mFinal = mIdx > 11 ? 0 : mIdx;
  const yFinal = mIdx > 11 ? now.getFullYear() + 1 : now.getFullYear();
  return `${MES_PT_FULL[mFinal]}/${String(yFinal).slice(2)}`;
}

// Paleta de cores por categoria
const CAT_COLORS = {
  "comida":              { bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)",  text: "#10b981",  dot: "#10b981"  },
  "mercado":             { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)",  text: "#60a5fa",  dot: "#3b82f6"  },
  "pito":                { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)",  text: "#f59e0b",  dot: "#f59e0b"  },
  "psicologa":           { bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.3)",   text: "#06b6d4",  dot: "#06b6d4"  },
  "outros (disponível)": { bg: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.3)",  text: "#a78bfa",  dot: "#8b5cf6"  },
};
const DEFAULT_CAT = { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)", text: "var(--text-secondary)", dot: "#6b7280" };
function catStyle(name) { return CAT_COLORS[String(name ?? "").toLowerCase()] ?? DEFAULT_CAT; }

// Formata "14/05/2026" → "Seg, 14 mai"
const WEEK_PT  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MON_PT   = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function fmtDayLabel(dateBR) {
  const [d, m, y] = dateBR.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEK_PT[dt.getDay()]}, ${String(d).padStart(2,"0")} ${MON_PT[m - 1]}`;
}

const inputSt = {
  width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, padding: "9px 12px", color: "#f0f0f8", fontSize: 14,
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const labelSt = {
  display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.07em", color: "rgba(255,255,255,0.35)", marginBottom: 5,
};

export default function LaunchPage() {
  const { data: finData, loading: finLoading, hideNumbers } = useFinance();
  const fmt      = (v) => fmtFin(v, hideNumbers);
  const fmtShort = (v) => fmtFin(v, hideNumbers);

  const categories = (finData?.gastos?.variaveis?.items ?? []).map(i => i.item);
  const melhorDia  = finData?.config?.melhorDiaCompra ?? null;
  const cicloAtual = cicloAtualLabel(melhorDia);

  // ── Estado: lançamento ───────────────────────────────────────────────────
  const [form, setForm]     = useState({ date: todayISO(), category: "", value: "" });
  const [saving, setSaving] = useState(false);

  // ── Estado: fechamento ───────────────────────────────────────────────────
  const [poup1, setPoup1]         = useState("");
  const [poup2, setPoup2]         = useState("");
  const [poup3, setPoup3]         = useState("");
  const [benef, setBenef]         = useState("");
  const [brad,  setBrad]          = useState("");
  const [nub,   setNub]           = useState("");
  const [melhorDiaInput, setMelhorDiaInput] = useState("");
  const [closePreview, setClosePreview] = useState(null);
  const [closing, setClosing]           = useState(false);
  const [closeResult, setCloseResult]   = useState(null);
  const [showClose, setShowClose]       = useState(false);

  // ── Estado: lista ────────────────────────────────────────────────────────
  const [entries,     setEntries]    = useState([]);
  const [entriesLoad,    setEntriesLoad]    = useState(true);
  const [openCiclos,     setOpenCiclos]     = useState({});
  const [monthsHistory,  setMonthsHistory]  = useState([]);
  const [monthsLoad,     setMonthsLoad]     = useState(true);

  // ── Toast ────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  function showToast(msg, warn = false) {
    setToast({ msg, warn });
    setTimeout(() => setToast(null), 3200);
  }

  // ── Fetch ────────────────────────────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    setEntriesLoad(true);
    try {
      const r = await fetch("/api/finance/launch", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setEntries(d.entries);
    } finally { setEntriesLoad(false); }
  }, []);

  const loadMonthsHistory = useCallback(async () => {
    setMonthsLoad(true);
    try {
      const r = await fetch("/api/finance/months-history", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setMonthsHistory(d.months);
    } finally { setMonthsLoad(false); }
  }, []);

  useEffect(() => {
    loadEntries();
    loadMonthsHistory();
    fetch("/api/finance/close-month", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setClosePreview(d);
          // Pré-preenche melhor dia com valor salvo no config
          if (d.melhorDiaAtual) setMelhorDiaInput(String(d.melhorDiaAtual));
        }
      })
      .catch(() => {});
  }, [loadEntries, loadMonthsHistory]);

  // ── Cálculos fechamento ──────────────────────────────────────────────────
  const totalPoup = [poup1, poup2, poup3, benef].reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const totalFat  = [brad, nub].reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const liquido   = totalPoup - totalFat;

  // ── Lançar gasto ─────────────────────────────────────────────────────────
  async function handleLaunch(e) {
    e.preventDefault();
    if (!form.category || !form.value || parseFloat(form.value) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finance/launch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: form.date, descricao: "", category: form.category, value: parseFloat(form.value), ciclo: cicloAtual ?? "" }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      showToast("✓ Lançamento registrado!");
      setForm({ date: todayISO(), category: form.category, value: "" });
      loadEntries();
    } catch (err) { showToast(`⚠ ${err.message}`, true); }
    finally { setSaving(false); }
  }

  // ── Fechar mês ───────────────────────────────────────────────────────────
  async function handleClose(e) {
    e.preventDefault();
    if (!totalPoup) return;
    setClosing(true);
    try {
      const res = await fetch("/api/finance/close-month", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poupancaTotal: totalPoup, poupancaFatura: totalFat, melhorDia: melhorDiaInput ? parseInt(melhorDiaInput) : undefined }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setCloseResult(j.resultado);
      showToast("✓ Mês fechado com sucesso!");
      setPoup1(""); setPoup2(""); setPoup3(""); setBenef(""); setBrad(""); setNub(""); setMelhorDiaInput("");
      setClosePreview(null);
      loadMonthsHistory();
    } catch (err) { showToast(`⚠ ${err.message}`, true); }
    finally { setClosing(false); }
  }

  // ── Agrupamento por ciclo → dia ──────────────────────────────────────────
  const byCiclo = {};
  for (const e of entries) {
    const c = e.ciclo || "—";
    if (!byCiclo[c]) byCiclo[c] = {};
    if (!byCiclo[c][e.data]) byCiclo[c][e.data] = [];
    byCiclo[c][e.data].push(e);
  }
  const ciclosSorted = Object.keys(byCiclo).sort((a, b) => {
    if (a === cicloAtual) return -1;
    if (b === cicloAtual) return 1;
    return a < b ? 1 : -1;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={finStyles.container}>
      <ModuleHeader title="Lançar" />
      <Navigation />

      {toast && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          background: toast.warn ? "rgba(245,158,11,0.95)" : "rgba(17,24,39,0.95)",
          border: `1px solid ${toast.warn ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)"}`,
          color: "#f0f0f8", padding: "10px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 600, zIndex: 999, whiteSpace: "nowrap",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>{toast.msg}</div>
      )}

      <header className={finStyles.header}>
        <div>
          <h1>Lançar</h1>
          <p style={{ textTransform: "capitalize" }}>
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </header>

      {/* ── Layout 2 colunas igual Gastos/Ganhos ── */}
      <div className={finStyles.body}>

        {/* ════ mainCol: lista de gastos por dia ════ */}
        <div className={finStyles.mainCol}>
          <div className={finStyles.content} style={{ paddingBottom: 80 }}>

            {entriesLoad ? (
              <p style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: 14 }}>Carregando...</p>
            ) : ciclosSorted.length === 0 ? (
              <p style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: 14 }}>Nenhum lançamento ainda.</p>
            ) : ciclosSorted.map((ciclo, ci) => {
              const isCurrent   = ciclo === cicloAtual;
              const diasByCiclo = byCiclo[ciclo];
              const dias = Object.keys(diasByCiclo).sort((a, b) => {
                const [da,ma,ya] = a.split("/").map(Number);
                const [db,mb,yb] = b.split("/").map(Number);
                return new Date(yb,mb-1,db) - new Date(ya,ma-1,da);
              });
              const totalCiclo = dias.reduce((s, d) => s + diasByCiclo[d].reduce((ss, e) => ss + e.valor, 0), 0);
              const isOpen     = isCurrent || !!openCiclos[ciclo];

              return (
                <div key={ciclo} style={{
                  marginBottom: 24,
                  background: "rgba(255,255,255,0.025)",
                  border: `1px solid ${isCurrent ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 16, overflow: "hidden",
                }}>
                  {/* Cabeçalho do ciclo — estilo group header */}
                  <button
                    type="button"
                    onClick={() => { if (!isCurrent) setOpenCiclos(s => ({ ...s, [ciclo]: !s[ciclo] })); }}
                    style={{
                      width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "14px 20px",
                      background: isCurrent ? "rgba(0,229,160,0.04)" : "rgba(255,255,255,0.02)",
                      border: "none", cursor: isCurrent ? "default" : "pointer", fontFamily: "inherit",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 5, height: 22, borderRadius: 2, background: isCurrent ? "var(--accent-primary)" : "rgba(255,255,255,0.2)" }} />
                      <span style={{ fontSize: 14, fontWeight: 800, textTransform: "capitalize", color: isCurrent ? "var(--accent-primary)" : "var(--text-primary)" }}>
                        {ciclo}
                      </span>
                      {isCurrent && (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(0,229,160,0.12)", color: "var(--accent-primary)", border: "1px solid rgba(0,229,160,0.25)", fontWeight: 700 }}>
                          atual
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 800, color: "#ef4444" }}>
                        {fmt(totalCiclo)}
                      </span>
                      {!isCurrent && (
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s", display: "inline-block" }}>▼</span>
                      )}
                    </div>
                  </button>

                  {/* Dias do ciclo */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "8px 16px 12px" }}>
                      {dias.map((dia, di) => {
                        const diaEntries = diasByCiclo[dia];
                        const diaTotal   = diaEntries.reduce((s, e) => s + e.valor, 0);
                        const isToday    = dia === new Date().toLocaleDateString("pt-BR");
                        return (
                          <div key={dia} style={{ marginBottom: di < dias.length - 1 ? 12 : 0 }}>
                            {/* Header do dia */}
                            <div style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              marginBottom: 6, paddingBottom: 5,
                              borderBottom: "1px solid rgba(255,255,255,0.06)",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  fontSize: 11, fontWeight: 700, color: isToday ? "var(--accent-primary)" : "var(--text-muted)",
                                  letterSpacing: "0.04em", textTransform: "uppercase",
                                }}>
                                  {fmtDayLabel(dia)}
                                </span>
                                {isToday && (
                                  <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 99, background: "rgba(0,229,160,0.12)", color: "var(--accent-primary)", border: "1px solid rgba(0,229,160,0.25)" }}>
                                    HOJE
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 800, color: "#f59e0b", fontFamily: "var(--font-mono)" }}>
                                {fmt(diaTotal)}
                              </span>
                            </div>

                            {/* Entradas com pill de categoria */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {diaEntries.map((e, i) => {
                                const cs = catStyle(e.categoria);
                                return (
                                  <div key={i} style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    padding: "6px 12px", borderRadius: 99,
                                    background: cs.bg, border: `1px solid ${cs.border}`,
                                  }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: cs.text }}>{e.categoria}</span>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: cs.text, fontFamily: "var(--font-mono)" }}>
                                      {fmtShort(e.valor)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ════ sideCol: formulários ════ */}
        <div className={finStyles.sideCol}>

          {/* ── Painel 1: Gasto Variável Dia ── */}
          <div className={finStyles.sidePanel}>
            <div className={finStyles.sidePanelTitle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>💸 Gasto Variável</span>
              {cicloAtual && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "rgba(0,229,160,0.1)", color: "var(--accent-primary)", border: "1px solid rgba(0,229,160,0.2)", textTransform: "none" }}>
                  {cicloAtual}
                </span>
              )}
            </div>

            <div style={{ padding: "14px 16px 16px" }}>
              <form onSubmit={handleLaunch} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={labelSt}>Data</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required style={{ ...inputSt, colorScheme: "dark" }} />
                </div>
                <div>
                  <label style={labelSt}>Categoria</label>
                  {finLoading ? (
                    <div style={{ ...inputSt, color: "var(--text-muted)", fontSize: 13 }}>Carregando...</div>
                  ) : (
                    <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} required style={{ ...inputSt, appearance: "none", cursor: "pointer" }}>
                      <option value="" disabled>Selecione</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label style={labelSt}>Valor (R$)</label>
                  <input type="number" step="0.01" min="0.01" value={form.value}
                    onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                    placeholder="0,00" required
                    style={{ ...inputSt, fontSize: 20, fontFamily: "var(--font-mono), monospace", fontWeight: 700 }}
                  />
                </div>
                <button type="submit" disabled={!form.category || !form.value || saving}
                  style={{
                    marginTop: 2, padding: "11px 0", borderRadius: 10, border: "none",
                    fontSize: 13, fontWeight: 700, color: "#fff",
                    background: (form.category && form.value && !saving) ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(255,255,255,0.06)",
                    cursor: (form.category && form.value && !saving) ? "pointer" : "not-allowed",
                    transition: "all 0.2s",
                  }}
                >
                  {saving ? "Salvando…" : "Registrar"}
                </button>
              </form>
            </div>
          </div>

          {/* ── Painel 2: Fechamento do Mês ── */}
          <div className={finStyles.sidePanel} style={{ marginTop: 12, border: closeResult ? "1px solid rgba(16,185,129,0.25)" : undefined }}>
            <div className={finStyles.sidePanelTitle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>🗓 Fechar Mês</span>
              {closePreview?.mesAtual && !closeResult && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", textTransform: "capitalize" }}>
                  {closePreview.mesAtual}
                </span>
              )}
            </div>

            <div style={{ padding: "14px 16px 16px" }}>
              {closeResult ? (
                /* Resultado */
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 12 }}>✓ Mês fechado!</div>
                  {[
                    ["📋 Fixos resetados",    closeResult.fixosResetados],
                    ["💳 Parcelas avançadas", closeResult.parcelasAvancadas],
                    ["💳 Concluídas",         closeResult.parcelasConcluidas],
                    ["💰 Ganhos resetados",   closeResult.ganhosResetados],
                    closeResult.poupancaAtualizada
                      ? [`🏦 ${closeResult.poupancaAtualizada.mes}`, fmtShort(closeResult.poupancaAtualizada.acumulado)]
                      : null,
                    closeResult.novoCicloInicio ? ["🗓 Novo ciclo", closeResult.novoCicloInicio] : null,
                    closeResult.novoMelhorDia   ? ["📅 Melhor dia", `dia ${closeResult.novoMelhorDia}`] : null,
                    closeResult.fixosAutoMantidos > 0 ? ["⚡ Fixos auto (pagos)", closeResult.fixosAutoMantidos] : null,
                  ].filter(Boolean).map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                      <span style={{ color: "var(--text-muted)" }}>{l}</span>
                      <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>{v}</span>
                    </div>
                  ))}
                  <button onClick={() => setCloseResult(null)} style={{ marginTop: 12, width: "100%", padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Ok
                  </button>
                </div>
              ) : !showClose ? (
                /* Botão para abrir o formulário */
                <button
                  onClick={() => setShowClose(true)}
                  style={{
                    width: "100%", padding: "11px 0", borderRadius: 10, border: "1px solid rgba(245,158,11,0.25)",
                    fontSize: 13, fontWeight: 700, color: "#f59e0b",
                    background: "rgba(245,158,11,0.08)", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Fechar {closePreview?.mesAtual ?? "Mês"}
                </button>
              ) : (
                /* Formulário de fechamento */
                <form onSubmit={handleClose} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Poupanças */}
                  <div>
                    <label style={labelSt}>Poupanças (R$)</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {[["P1", poup1, setPoup1], ["P2", poup2, setPoup2], ["P3", poup3, setPoup3], ["Benef.", benef, setBenef]].map(([lbl, val, set]) => (
                        <div key={lbl}>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 3, textTransform: "uppercase" }}>{lbl}</div>
                          <input type="number" step="0.01" min="0" value={val} onChange={e => set(e.target.value)}
                            placeholder="0" style={{ ...inputSt, padding: "7px 10px", fontSize: 13, fontFamily: "var(--font-mono), monospace" }} />
                        </div>
                      ))}
                    </div>
                    {totalPoup > 0 && <div style={{ fontSize: 11, color: "#10b981", marginTop: 5, textAlign: "right", fontFamily: "var(--font-mono)" }}>{fmtShort(totalPoup)}</div>}
                  </div>

                  {/* Faturas */}
                  <div>
                    <label style={labelSt}>Faturas (R$)</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {[["Bradesco", brad, setBrad], ["Nubank", nub, setNub]].map(([lbl, val, set]) => (
                        <div key={lbl}>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 3, textTransform: "uppercase" }}>{lbl}</div>
                          <input type="number" step="0.01" min="0" value={val} onChange={e => set(e.target.value)}
                            placeholder="0" style={{ ...inputSt, padding: "7px 10px", fontSize: 13, fontFamily: "var(--font-mono), monospace" }} />
                        </div>
                      ))}
                    </div>
                    {totalFat > 0 && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 5, textAlign: "right", fontFamily: "var(--font-mono)" }}>{fmtShort(totalFat)}</div>}
                  </div>

                  {/* Melhor dia de compra do próximo ciclo */}
                  <div>
                    <label style={labelSt}>Melhor dia de compra <span style={{ opacity: 0.5 }}>(próximo ciclo)</span></label>
                    <input
                      type="number" min="1" max="31" step="1"
                      value={melhorDiaInput}
                      onChange={e => setMelhorDiaInput(e.target.value)}
                      placeholder={closePreview?.melhorDiaAtual ? `Atual: dia ${closePreview.melhorDiaAtual}` : "Ex: 10"}
                      style={{ ...inputSt, padding: "7px 10px", fontSize: 14, fontFamily: "var(--font-mono), monospace" }}
                    />
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
                      Define o início do ciclo do cartão. Deixe em branco para manter o atual.
                    </div>
                  </div>

                  {/* Líquido */}
                  {totalPoup > 0 && (
                    <div style={{ padding: "9px 12px", borderRadius: 10, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Poupança líquida</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 900, fontSize: 16, color: liquido >= 0 ? "#10b981" : "#ef4444" }}>{fmtShort(liquido)}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    <button type="button" onClick={() => setShowClose(false)}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={!totalPoup || closing}
                      style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, color: "#fff",
                        background: (totalPoup && !closing) ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.06)",
                        cursor: (totalPoup && !closing) ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                      {closing ? "Fechando…" : `✓ Confirmar`}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* ── Painel 3: Histórico de Fechamentos ── */}
          {(monthsLoad || monthsHistory.length > 0) && (
            <div className={finStyles.sidePanel} style={{ marginTop: 12 }}>
              <div className={finStyles.sidePanelTitle}>
                <span>📅 Fechamentos</span>
              </div>
              <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {monthsLoad ? (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>Carregando...</p>
                ) : monthsHistory.map((m, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12, padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, textTransform: "capitalize", color: "var(--text-primary)" }}>{m.ciclo}</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>fechado {m.fechadoEm}</span>
                    </div>
                    {[
                      ["💰 Ganhos",    m.ganhos,    "#10b981"],
                      ["📋 Fixos",     m.fixos,     "var(--text-secondary)"],
                      ["💸 Variáveis", m.variaveis, "#f59e0b"],
                      ["🏦 Poupança",  m.poupanca,  "#3b82f6"],
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
                        <span style={{ color: "var(--text-muted)" }}>{label}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color }}>{fmt(val)}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Saldo</span>
                      <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 900, color: m.saldo >= 0 ? "#10b981" : "#ef4444" }}>{fmt(m.saldo)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
