"use client";
// Financeiro > Lançar — mesmo padrão visual de Gastos/Ganhos.
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import FinanceOcultarBtn from "@/components/ui/FinanceOcultarBtn";
import ex from "../expenses/Expenses.module.css";
import ln from "./Launch.module.css";
import { useFinance } from "@/hooks/useFinance";
import { fmtFin } from "@/lib/fmtFin";

// ── Formatadores ──────────────────────────────────────────────────────────────
// Data de hoje no fuso do aparelho (antes usava UTC e, à noite, já mostrava o dia seguinte)
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MES_PT_FULL = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
function cicloAtualLabel(melhorDia, cicloInicio) {
  if (!melhorDia) return null;
  if (cicloInicio) {
    const parts = cicloInicio.split("/").map(Number);
    const ciMm = parts[1], ciYyyy = parts[2];
    if (ciMm && ciYyyy) {
      const nextMon = ciMm % 12; // 0-indexed do mês seguinte
      const nextYr  = ciMm === 12 ? ciYyyy + 1 : ciYyyy;
      return `${MES_PT_FULL[nextMon]}/${String(nextYr).slice(2)}`;
    }
  }
  const now   = new Date();
  const today = now.getDate();
  const mIdx  = today < melhorDia ? now.getMonth() : now.getMonth() + 1;
  const mFinal = mIdx > 11 ? 0 : mIdx;
  const yFinal = mIdx > 11 ? now.getFullYear() + 1 : now.getFullYear();
  return `${MES_PT_FULL[mFinal]}/${String(yFinal).slice(2)}`;
}

// Cor de cada categoria (as conhecidas têm cor fixa; as demais pegam da paleta)
const CAT_FIXA = { "comida": "#34d399", "mercado": "#38bdf8", "pito": "#fbbf24", "psicologa": "#22d3ee", "outros (disponível)": "#a78bfa", "outros": "#a78bfa", "transporte": "#fb7185" };
const PALETA   = ["#f472b6", "#f97316", "#a3e635", "#e879f9", "#60a5fa", "#facc15"];
function catColor(name) {
  const k = String(name ?? "").toLowerCase();
  if (CAT_FIXA[k]) return CAT_FIXA[k];
  let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

// "14/05/2026" → "Seg, 14 mai"
const WEEK_PT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MON_PT  = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function fmtDayLabel(dateBR) {
  const [d, m, y] = dateBR.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEK_PT[dt.getDay()]}, ${String(d).padStart(2,"0")} ${MON_PT[m - 1]}`;
}

const TRASH_ICON = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>;

export default function LaunchPage() {
  const { data: finData, loading: finLoading, hideNumbers, refetch } = useFinance();
  const fmt = (v) => fmtFin(v, hideNumbers);

  const categories  = (finData?.gastos?.variaveis?.items ?? []).map(i => i.item);
  const melhorDia   = finData?.config?.melhorDiaCompra ?? null;
  const cicloInicio = finData?.config?.cicloInicio ?? null;
  const cicloAtual  = cicloAtualLabel(melhorDia, cicloInicio);

  // ── Estado: lançamento ───────────────────────────────────────────────────
  const [form, setForm]     = useState({ date: todayISO(), category: "", value: "", ciclo: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting]   = useState(null); // rowIndex sendo apagado
  const [delConfirm, setDelConfirm] = useState(null); // rowIndex aguardando confirmação

  async function handleDelete(rowIndex) {
    if (delConfirm !== rowIndex) { setDelConfirm(rowIndex); return; }
    setDelConfirm(null);
    setDeleting(rowIndex);
    try {
      const res = await fetch("/api/finance/launch", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      showToast("✓ Lançamento apagado");
      loadEntries();
      refetch(true);
    } catch (err) { showToast(`⚠ ${err.message}`, true); }
    finally { setDeleting(null); }
  }

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
  const [entries,       setEntries]       = useState([]);
  const [entriesLoad,   setEntriesLoad]   = useState(true);
  const [openCiclos,    setOpenCiclos]    = useState({});
  const [monthsHistory, setMonthsHistory] = useState([]);
  const [monthsLoad,    setMonthsLoad]    = useState(true);

  // ── Ciclo padrão + lista de ciclos disponíveis ────────────────────────────
  useEffect(() => {
    if (cicloAtual && !form.ciclo) setForm(p => ({ ...p, ciclo: cicloAtual }));
  }, [cicloAtual]);

  const availableCycles = (() => {
    const generated = [];
    if (melhorDia) {
      const now = new Date();
      let sM = now.getDate() < melhorDia ? now.getMonth() : now.getMonth() + 1;
      let sY = now.getFullYear();
      if (sM > 11) { sM -= 12; sY++; }
      for (let i = 0; i < 6; i++) {
        let m = sM - i, y = sY;
        while (m < 0) { m += 12; y--; }
        generated.push(`${MES_PT_FULL[m]}/${String(y).slice(2)}`);
      }
    }
    const fromEntries = entries.map(e => e.ciclo).filter(Boolean);
    const all = [...new Set([...generated, ...fromEntries])];
    const parse = (s) => {
      const [mes, ano] = (s ?? "").split("/");
      const mIdx = MES_PT_FULL.indexOf(mes?.toLowerCase());
      return mIdx >= 0 ? (2000 + parseInt(ano || "0")) * 12 + mIdx : 0;
    };
    return all.sort((a, b) => parse(b) - parse(a));
  })();

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

  const loadClosePreview = useCallback(() => {
    fetch("/api/finance/close-month", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setClosePreview(d);
          if (d.melhorDiaAtual) setMelhorDiaInput(String(d.melhorDiaAtual));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadEntries();
    loadMonthsHistory();
    loadClosePreview();
  }, [loadEntries, loadMonthsHistory, loadClosePreview]);

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
        body: JSON.stringify({ date: form.date, descricao: "", category: form.category, value: parseFloat(form.value), ciclo: form.ciclo || cicloAtual || "" }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      showToast("✓ Lançamento registrado!");
      setForm(p => ({ date: todayISO(), category: p.category, value: "", ciclo: p.ciclo }));
      loadEntries();
      refetch(true);
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
      loadMonthsHistory();
      loadClosePreview();
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
  const parseCiclo = (s) => {
    const [mes, ano] = (s ?? "").split("/");
    const mIdx = MES_PT_FULL.indexOf(mes?.toLowerCase());
    return mIdx >= 0 ? (2000 + parseInt(ano || "0")) * 12 + mIdx : 0;
  };
  // Ciclo mais recente primeiro
  const ciclosSorted = Object.keys(byCiclo).sort((a, b) => parseCiclo(b) - parseCiclo(a));

  // ── Big numbers ──────────────────────────────────────────────────────────
  const hojeBR      = new Date().toLocaleDateString("pt-BR");
  const doCiclo     = entries.filter(e => e.ciclo === cicloAtual);
  const totalCiclo  = doCiclo.reduce((s, e) => s + e.valor, 0);
  const totalHoje   = entries.filter(e => e.data === hojeBR).reduce((s, e) => s + e.valor, 0);
  const diasCiclo   = new Set(doCiclo.map(e => e.data)).size;
  const mediaDia    = diasCiclo > 0 ? totalCiclo / diasCiclo : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={ex.page} style={{ background: "radial-gradient(50% 35% at 85% 0%, rgba(251,191,36,0.09), transparent 70%), #07080c" }}>
      <ModuleHeader title="Lançar" hideOnDesktop />
      <Navigation />

      {toast && <div className={ex.toast} style={toast.warn ? { borderColor: "rgba(251,191,36,0.5)", color: "#fde68a" } : undefined}>{toast.msg}</div>}

      {/* Cabeçalho */}
      <header className={ex.top}>
        <div className={ex.topLeft}>
          <span className={ex.eyebrow}>
            Financeiro · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <h1 className={ex.title}>Lançar</h1>
        </div>
        <div className={ex.topRight}>
          <FinanceOcultarBtn className={ex.pillBtn} />
        </div>
      </header>

      {/* Big numbers */}
      <div className={ex.tabs}>
        {[
          { label: "Hoje",          value: fmt(totalHoje),  color: "#fbbf24", hint: "gasto no dia" },
          { label: "No ciclo",      value: fmt(totalCiclo), color: "#fb7185", hint: cicloAtual ? `ciclo de ${cicloAtual}` : "ciclo atual" },
          { label: "Média por dia", value: fmt(mediaDia),   color: "#38bdf8", hint: `${diasCiclo} dia${diasCiclo === 1 ? "" : "s"} com gasto` },
          { label: "Lançamentos",   value: String(doCiclo.length), color: "#a78bfa", hint: "neste ciclo" },
        ].map(s => (
          <div key={s.label} className={ex.tabBox} style={{ "--t": s.color }}>
            <span className={ex.tabLabel}><span className={ex.tabDot} />{s.label}</span>
            <span className={ex.tabValue} style={{ color: s.color }}>{s.value}</span>
            <span className={ex.tabHint}>{s.hint}</span>
          </div>
        ))}
      </div>

      <div className={ex.layout}>
        {/* ════ Lista: ciclo → dia → lançamentos ════ */}
        <div className={ex.mainArea}>
          {entriesLoad ? (
            <p className={ex.empty}>Carregando…</p>
          ) : ciclosSorted.length === 0 ? (
            <p className={ex.empty}>Nenhum lançamento ainda.</p>
          ) : ciclosSorted.map(ciclo => {
            const isCurrent   = ciclo === cicloAtual;
            const diasByCiclo = byCiclo[ciclo];
            const dias = Object.keys(diasByCiclo).sort((a, b) => {
              const [da,ma,ya] = a.split("/").map(Number);
              const [db,mb,yb] = b.split("/").map(Number);
              return new Date(yb,mb-1,db) - new Date(ya,ma-1,da);
            });
            const total  = dias.reduce((s, d) => s + diasByCiclo[d].reduce((ss, e) => ss + e.valor, 0), 0);
            const qtd    = dias.reduce((s, d) => s + diasByCiclo[d].length, 0);
            const isOpen = isCurrent || !!openCiclos[ciclo];
            const cor    = isCurrent ? "#34d399" : "rgba(255,255,255,0.35)";

            return (
              <section key={ciclo} className={ex.listPanel}>
                <button type="button" disabled={isCurrent}
                  onClick={() => setOpenCiclos(s => ({ ...s, [ciclo]: !s[ciclo] }))}
                  className={`${ex.sectionHead} ${ln.cycleBtn}`}>
                  <span className={ex.sectionDot} style={{ background: cor, boxShadow: isCurrent ? `0 0 10px ${cor}` : "none" }} />
                  <span className={ex.sectionName} style={{ textTransform: "capitalize" }}>{ciclo}</span>
                  {isCurrent ? <span className={ln.nowTag}>atual</span> : <span className={ex.sectionCount}>{qtd}</span>}
                  <span className={ex.sectionTotal}>{fmt(total)}</span>
                  {!isCurrent && <span className={`${ln.chev} ${isOpen ? ln.chevOpen : ""}`}>▼</span>}
                </button>

                {isOpen && dias.map(dia => {
                  const diaEntries = diasByCiclo[dia];
                  const diaTotal   = diaEntries.reduce((s, e) => s + e.valor, 0);
                  const isToday    = dia === hojeBR;
                  return (
                    <div key={dia}>
                      <div className={ln.dayHead}>
                        <span className={`${ln.dayName} ${isToday ? ln.dayToday : ""}`}>
                          {fmtDayLabel(dia)}{isToday && <span className={ln.nowTag}>hoje</span>}
                        </span>
                        <span className={ln.dayTotal}>{fmt(diaTotal)}</span>
                      </div>
                      {diaEntries.map((e, i) => {
                        const c      = catColor(e.categoria);
                        const isDel  = deleting === e.rowIndex;
                        const isConf = delConfirm === e.rowIndex;
                        return (
                          <div key={`${e.rowIndex}-${i}`} className={ex.uRow} style={{ "--c": c, minHeight: 50 }}>
                            <span className={ex.uLead}><i className={ex.uDot} /></span>
                            <div className={`${ex.uName} ${ex.uWide}`}><span className={ex.rowName}>{e.categoria}</span></div>
                            <span className={ex.uAux} />
                            <span className={ex.uVal}><b>{fmt(e.valor)}</b></span>
                            <div className={ex.uActs}>
                              {isConf ? (
                                <button onClick={() => handleDelete(e.rowIndex)} disabled={isDel} className={ex.confirmBtn}
                                  onBlur={() => setTimeout(() => setDelConfirm(v => v === e.rowIndex ? null : v), 200)}>
                                  {isDel ? "…" : "Apagar?"}
                                </button>
                              ) : (
                                <button onClick={() => handleDelete(e.rowIndex)} disabled={isDel} title="Apagar" className={`${ex.iconBtn} ${ex.dangerBtn}`}>
                                  {isDel ? "…" : TRASH_ICON}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        {/* ════ Lateral: lançar, fechar mês, histórico ════ */}
        <div className={`${ex.side} ${ln.sideFirst}`} style={{ position: "static" }}>

          {/* Novo gasto */}
          <div className={ex.panel}>
            <div className={ln.panelHead}>
              <div className={ex.panelTitle} style={{ marginBottom: 0 }}>Novo gasto</div>
              {cicloAtual && <span className={ln.tag} style={{ color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)" }}>{cicloAtual}</span>}
            </div>
            <form onSubmit={handleLaunch} className={ln.form}>
              <div>
                <label className={ln.lbl}>Categoria</label>
                {finLoading ? (
                  <p className={ln.hint}>Carregando…</p>
                ) : (
                  <div className={ln.chips}>
                    {categories.map(c => (
                      <button key={c} type="button" onClick={() => setForm(p => ({ ...p, category: c }))}
                        className={`${ln.chip} ${form.category === c ? ln.chipOn : ""}`} style={{ "--c": catColor(c) }}>
                        <i />{c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className={ln.lbl}>Valor (R$)</label>
                <input type="number" step="0.01" min="0.01" inputMode="decimal" value={form.value}
                  onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                  placeholder="0,00" required className={`${ln.input} ${ln.bigInput}`} />
              </div>
              <div className={ln.two}>
                <div>
                  <label className={ln.lbl}>Data</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required className={ln.input} />
                </div>
                <div>
                  <label className={ln.lbl}>Ciclo</label>
                  <select value={form.ciclo} onChange={e => setForm(p => ({ ...p, ciclo: e.target.value }))}
                    className={ln.input} style={{ cursor: "pointer", textTransform: "capitalize" }}>
                    {availableCycles.map(c => (
                      <option key={c} value={c}>{c}{c === cicloAtual ? " (atual)" : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={!form.category || !form.value || saving} className={ln.submit}>
                {saving ? "Salvando…" : "Registrar gasto"}
              </button>
            </form>
          </div>

          {/* Fechar mês */}
          <div className={ex.panel} style={closeResult ? { borderColor: "rgba(52,211,153,0.3)" } : undefined}>
            <div className={ln.panelHead}>
              <div className={ex.panelTitle} style={{ marginBottom: 0 }}>Fechar mês</div>
              {closePreview?.mesAtual && !closeResult && (
                <span className={ln.tag} style={{ color: "#fbbf24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}>{closePreview.mesAtual}</span>
              )}
            </div>

            {closeResult ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#34d399", marginBottom: 10 }}>✓ Mês fechado!</div>
                {[
                  ["Fixos resetados",    closeResult.fixosResetados],
                  ["Parcelas avançadas", closeResult.parcelasAvancadas],
                  ["Parcelas concluídas", closeResult.parcelasConcluidas],
                  ["Ganhos resetados",   closeResult.ganhosResetados],
                  closeResult.poupancaAtualizada ? [`Poupança ${closeResult.poupancaAtualizada.mes}`, fmt(closeResult.poupancaAtualizada.acumulado)] : null,
                  closeResult.novoCicloInicio ? ["Novo ciclo", closeResult.novoCicloInicio] : null,
                  closeResult.novoMelhorDia   ? ["Melhor dia", `dia ${closeResult.novoMelhorDia}`] : null,
                  closeResult.fixosAutoMantidos > 0 ? ["Fixos automáticos (pagos)", closeResult.fixosAutoMantidos] : null,
                ].filter(Boolean).map(([l, v]) => (
                  <div key={l} className={ln.kv}><span>{l}</span><b>{v}</b></div>
                ))}
                <button onClick={() => setCloseResult(null)} className={ln.closeOpen} style={{ marginTop: 14, color: "#fff", background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)" }}>Ok</button>
              </div>
            ) : !showClose ? (
              <button onClick={() => setShowClose(true)} className={ln.closeOpen}>
                Fechar {closePreview?.mesAtual ?? "mês"}
              </button>
            ) : (
              <form onSubmit={handleClose} className={ln.form}>
                <div>
                  <label className={ln.lbl}>Poupanças (R$)</label>
                  <div className={ln.two}>
                    {[["Poupança 1", poup1, setPoup1], ["Poupança 2", poup2, setPoup2], ["Poupança 3", poup3, setPoup3], ["Benefício", benef, setBenef]].map(([l, val, set]) => (
                      <div key={l}>
                        <div className={ln.mini}>{l}</div>
                        <input type="number" step="0.01" min="0" inputMode="decimal" value={val} onChange={e => set(e.target.value)} placeholder="0" className={ln.input} />
                      </div>
                    ))}
                  </div>
                  {totalPoup > 0 && <div className={ln.sum} style={{ color: "#34d399" }}>{fmt(totalPoup)}</div>}
                </div>
                <div>
                  <label className={ln.lbl}>Faturas (R$)</label>
                  <div className={ln.two}>
                    {[["Bradesco", brad, setBrad], ["Nubank", nub, setNub]].map(([l, val, set]) => (
                      <div key={l}>
                        <div className={ln.mini}>{l}</div>
                        <input type="number" step="0.01" min="0" inputMode="decimal" value={val} onChange={e => set(e.target.value)} placeholder="0" className={ln.input} />
                      </div>
                    ))}
                  </div>
                  {totalFat > 0 && <div className={ln.sum} style={{ color: "#fb7185" }}>{fmt(totalFat)}</div>}
                </div>
                <div>
                  <label className={ln.lbl}>Melhor dia de compra (próximo ciclo)</label>
                  <input type="number" min="1" max="31" step="1" value={melhorDiaInput} onChange={e => setMelhorDiaInput(e.target.value)}
                    placeholder={closePreview?.melhorDiaAtual ? `Atual: dia ${closePreview.melhorDiaAtual}` : "Ex: 10"} className={ln.input} />
                  <p className={ln.hint}>Define o início do ciclo do cartão. Deixe em branco para manter o atual.</p>
                </div>
                {totalPoup > 0 && (
                  <div className={ln.net}>
                    <span>Poupança líquida</span>
                    <b style={{ color: liquido >= 0 ? "#34d399" : "#fb7185" }}>{fmt(liquido)}</b>
                  </div>
                )}
                <div className={ln.btnRow}>
                  <button type="button" onClick={() => setShowClose(false)} className={ln.ghost}>Cancelar</button>
                  <button type="submit" disabled={!totalPoup || closing} className={ln.submit}>{closing ? "Fechando…" : "Confirmar fechamento"}</button>
                </div>
              </form>
            )}
          </div>

          {/* Histórico de fechamentos */}
          {(monthsLoad || monthsHistory.length > 0) && (
            <div className={ex.panel}>
              <div className={ln.panelHead}>
                <div className={ex.panelTitle} style={{ marginBottom: 0 }}>Fechamentos</div>
                <button className={ln.smallBtn}
                  onClick={async () => {
                    const r = await fetch("/api/finance/months-history", { method: "PATCH" });
                    const d = await r.json();
                    if (d.ok) { showToast(`✓ ${d.rowsFixed} registro(s) recalculado(s)`); loadMonthsHistory(); }
                    else showToast("⚠ Erro ao recalcular", true);
                  }}>
                  Recalcular
                </button>
              </div>
              <div className={ln.hist}>
                {monthsLoad ? (
                  <p className={ln.hint} style={{ textAlign: "center" }}>Carregando…</p>
                ) : monthsHistory.map((m, i) => (
                  <div key={i} className={ln.histCard}>
                    <div className={ln.histTop}><b>{m.ciclo}</b><span>fechado {m.fechadoEm}</span></div>
                    {[
                      ["Ganhos",    m.ganhos,    "#34d399"],
                      ["Fixos",     m.fixos,     "#38bdf8"],
                      ["Variáveis", m.variaveis, "#fbbf24"],
                      ...(m.parcelas > 0 ? [["Parcelas", m.parcelas, "#a78bfa"]] : []),
                      ["Poupança",  m.poupanca,  "#60a5fa"],
                    ].map(([label, val, color]) => (
                      <div key={label} className={ln.kv} style={{ padding: "4px 0", fontSize: 12.5 }}><span>{label}</span><b style={{ color }}>{fmt(val)}</b></div>
                    ))}
                    <div className={ln.histSaldo}>
                      <span>Saldo calculado</span>
                      <b style={{ color: m.saldo >= 0 ? "#34d399" : "#fb7185" }}>{fmt(m.saldo)}</b>
                    </div>
                    {(m.saldoReal !== 0 || m.diferenca !== 0) && (<>
                      <div className={ln.kv} style={{ padding: "4px 0", fontSize: 12.5 }}><span>Saldo real (Δ poupança)</span><b style={{ color: m.saldoReal >= 0 ? "#60a5fa" : "#fb7185" }}>{fmt(m.saldoReal)}</b></div>
                      <div className={ln.kv} style={{ padding: "4px 0", fontSize: 12.5 }}><span>Diferença</span><b style={{ color: Math.abs(m.diferenca) < 100 ? "#34d399" : "#fbbf24" }}>{fmt(m.diferenca)}</b></div>
                    </>)}
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
