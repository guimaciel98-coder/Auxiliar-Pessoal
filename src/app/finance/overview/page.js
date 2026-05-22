"use client";
import { useState, useMemo, useEffect } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "../Finance.module.css";
import { useFinance } from "@/hooks/useFinance";
import { fmtFin } from "@/lib/fmtFin";
import FinanceOcultarBtn from "@/components/ui/FinanceOcultarBtn";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
  PieChart, Pie, Cell,
} from "recharts";

// ── Formatadores ──────────────────────────────────────────────────────────────
function budgetBarColor(pct) {
  if (pct >= 100) return "#ef4444";
  if (pct >= 70)  return "#f59e0b";
  return "#10b981";
}

// Converte "julho/25", "julho/2025" ou ISO timestamp → "jul/25"
const MES_ABBR = {
  janeiro:"jan", fevereiro:"fev", março:"mar", marco:"mar", abril:"abr",
  maio:"mai", junho:"jun", julho:"jul", agosto:"ago",
  setembro:"set", outubro:"out", novembro:"nov", dezembro:"dez",
};
const MES_NUM_ABBR = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function abrevMes(m) {
  const s = String(m ?? "").trim();
  // ISO / timestamp numérico
  if (/^\d{4}-\d{2}/.test(s) || /^\d{10,}$/.test(s)) {
    const d = new Date(isNaN(s) ? s : Number(s));
    return `${MES_NUM_ABBR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
  }
  // "julho/2025" ou "julho/25"
  const [name, year] = s.split("/");
  const yy = year?.length === 4 ? year.slice(2) : year;
  return `${MES_ABBR[name?.toLowerCase().trim()] || name?.slice(0, 3)}/${yy?.trim()}`;
}

const AXIS_TICK  = { fill: "#6b7280", fontSize: 10 };
const GRID_LINE  = "rgba(255,255,255,0.06)";
const TOOLTIP_CS = {
  background: "#1f2937", border: "1px solid rgba(55,65,81,0.7)",
  borderRadius: 10, fontSize: 12, padding: "8px 12px",
};

// ── Helpers de projeção ───────────────────────────────────────────────────────
const MESES_PT = {
  "janeiro":1,"fevereiro":2,"março":3,"marco":3,"abril":4,"maio":5,"junho":6,
  "julho":7,"agosto":8,"setembro":9,"outubro":10,"novembro":11,"dezembro":12,
  "jan":1,"fev":2,"mar":3,"abr":4,"mai":5,"jun":6,
  "jul":7,"ago":8,"set":9,"out":10,"nov":11,"dez":12,
};

function parsePrazo(prazo) {
  if (!prazo) return null;
  const parts = String(prazo).toLowerCase().trim().split("/");
  if (parts.length !== 2) return null;
  const rawYear = parts[1]?.trim();
  const ano = rawYear ? (parseInt(rawYear) < 100 ? 2000 + parseInt(rawYear) : parseInt(rawYear)) : null;
  if (!ano) return null;
  // Formato numérico: "05/2026" (App_Parcelas)
  const numMes = parseInt(parts[0]);
  if (!isNaN(numMes) && numMes >= 1 && numMes <= 12) return { mes: numMes, ano };
  // Formato textual: "maio/2026" ou "mai/26"
  const mes = MESES_PT[parts[0]?.trim()];
  return mes ? { mes, ano } : null;
}

/**
 * buildProjection — projeta poupança mês a mês até dez/26.
 *
 * Fórmula por mês:
 *   mensal = poupancaRealBase + freed
 *   freed  = soma das parcelas que JÁ encerraram ANTES deste mês
 *
 * poupancaRealBase já inclui o custo de todas as parcelas ativas agora.
 * Conforme cada parcela encerra, seu valorMensal é somado ao freed,
 * aumentando o que sobra — sem esperar o mês virar para computar.
 */
function buildProjection(acumulado, poupancaRealBase, commitments) {
  const now   = new Date();
  let   month = now.getMonth() + 1;
  let   year  = now.getFullYear();
  let   running = acumulado;
  const result  = [];

  // Simula até dez/26
  while (year < 2026 || (year === 2026 && month <= 12)) {
    // Valor acumulado das parcelas que já encerraram ANTES deste mês
    // (encerrou no mês passado ou antes → dinheiro livre a partir deste mês)
    const freed = commitments.reduce((s, c) => {
      const p = parsePrazo(c.prazo);
      if (!p) return s; // sem data fim → ainda ativa, não libera
      const jaEncerrou = (p.ano < year) || (p.ano === year && p.mes < month);
      return jaEncerrou ? s + c.valorMensal : s;
    }, 0);

    running += poupancaRealBase + freed;

    result.push({
      mes:      `${MES_NUM_ABBR[month - 1]}/${String(year).slice(2)}`,
      projecao: Math.round(running),
    });
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return result;
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const { data, loading, error, refetch, hideNumbers } = useFinance();
  const fmt      = (v) => fmtFin(v, hideNumbers);
  const fmtShort = (v) => fmtFin(v, hideNumbers);

  const [addModal, setAddModal] = useState(false);
  const [addCat, setAddCat]     = useState("");
  const [addVal, setAddVal]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);

  // Dados do endpoint /api/finance/savings
  const [savingsData, setSavingsData] = useState(null);

  useEffect(() => {
    fetch("/api/finance/savings", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.ok) setSavingsData(d); })
      .catch(() => {});
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  async function handleAdd(e) {
    e.preventDefault();
    if (!addCat || !addVal || parseFloat(addVal) <= 0) return;
    setSaving(true);
    try {
      const res  = await fetch("/api/finance/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: addCat, value: parseFloat(addVal) }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      showToast(`✓ ${addCat}: ${fmt(parseFloat(addVal))} registrado`);
      setAddCat(""); setAddVal(""); setAddModal(false);
      refetch();
    } catch (err) {
      showToast(`⚠ ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const summary      = data?.summary  ?? {};
  const poupanca     = data?.poupanca ?? {};
  const variaveis    = data?.gastos?.variaveis?.items ?? [];
  const compromissos = data?.compromissos?.items ?? [];

  // ── Saldo Disponível (variáveis) — definido antes de gastosAteMomento ────
  const varPrevTotal = data?.gastos?.variaveis?.previsaoTotal ?? variaveis.reduce((s,i) => s + (i.previsao||0), 0);
  const varRealTotal = data?.gastos?.variaveis?.realTotal ?? 0;
  const varSaldo  = varPrevTotal - varRealTotal;
  const varPct    = varPrevTotal > 0 ? Math.min(Math.round((varRealTotal / varPrevTotal) * 100), 100) : 0;
  const varRawPct = varPrevTotal > 0 ? Math.round((varRealTotal / varPrevTotal) * 100) : 0;
  const varColor  = varSaldo < 0 ? "#ef4444" : varRawPct >= 70 ? "#f59e0b" : "#10b981";

  // ── Gastos até agora (3 fontes corretas) ─────────────────────────────────
  // 1. Variáveis: App_Lancamentos filtrado pelo ciclo atual
  const gastosVariaveisReal = varRealTotal;
  // 2. Fixos pagos: App_Gastos_Fixos ctrl=TRUE, excluindo parcelas ("Até")
  const gastosFixosPagos = (data?.gastos?.fixos?.items ?? [])
    .filter(i => i.ctrl && !i.item.includes("Até"))
    .reduce((s, i) => s + i.real, 0);
  // 3. Parcelas do mês: App_Parcelas — valorMensal das parcelas ativas
  const gastosParcelasMes = compromissos.reduce((s, c) => s + c.valorMensal, 0);

  const gastosAteMomento = gastosVariaveisReal + gastosFixosPagos + gastosParcelasMes;
  const poupancaReal     = (summary.ganhoTudo ?? 0) - gastosAteMomento;

  // Poupança acumulada — último mês atingido (valor já é acumulado na planilha)
  const historico         = savingsData?.historico ?? poupanca.historico ?? [];
  const poupancaAcumulada = savingsData?.acumulado
    ?? (() => { const a = historico.filter(m => m.atingido); return a.length ? a[a.length-1].valor : 0; })();
  const mesesAtingidos    = historico.filter(m => m.atingido).length;

  // ── Donut por grupo (Casa / Pessoal / Outros / Parcelas) ──────────────────
  const DONUT_COLORS = { Casa: "#3b82f6", Pessoal: "#10b981", Outros: "#f59e0b", Parcelas: "#8b5cf6" };

  const donutData = useMemo(() => {
    const groups = { Casa: 0, Pessoal: 0, Outros: 0, Parcelas: 0 };

    // Mapa rápido de variáveis por nome (App_Gastos_Variaveis)
    const varMap = {};
    for (const item of data?.gastos?.variaveis?.items ?? []) {
      varMap[item.item] = item;
    }

    // App_Gastos_Fixos → Casa, Pessoal, Outros
    // Itens com "Até" no nome são parcelas — vêm do App_Parcelas, então ignoramos aqui
    for (const item of data?.gastos?.fixos?.items ?? []) {
      if (!item.real || item.item.includes("Até")) continue;
      if      (item.grupo === "Casa")    groups.Casa    += item.real;
      else if (item.grupo === "Pessoal") groups.Pessoal += item.real;
      else if (item.grupo === "Outros")  groups.Outros  += item.real;
    }

    // App_Gastos_Variaveis → Casa: Mercado
    if (varMap["Mercado"]?.real) groups.Casa += varMap["Mercado"].real;

    // App_Gastos_Variaveis → Pessoal: Comida, Pito, Psicologa, Outros (Disponível)
    for (const nome of ["Comida", "Pito", "Psicologa", "Outros (Disponível)"]) {
      if (varMap[nome]?.real) groups.Pessoal += varMap[nome].real;
    }

    // App_Parcelas → Parcelas: soma dos valorMensal das parcelas ativas não quitadas
    for (const c of data?.compromissos?.items ?? []) {
      if (c.valorMensal) groups.Parcelas += c.valorMensal;
    }

    return Object.entries(groups)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [data]);

  // Gráfico unificado: histórico + projeção num único dataset
  const mesAtualLabel = `${MES_NUM_ABBR[new Date().getMonth()]}/${String(new Date().getFullYear()).slice(2)}`;

  const chartData = useMemo(() => {
    const map = new Map();
    historico.forEach(m => {
      const label = abrevMes(m.mes);
      map.set(label, { mes: label, historico: m.valor, atingido: m.atingido });
    });
    // Usa poupancaReal (ganhos − gastos do mês atual) como base da projeção.
    // buildProjection adiciona mês a mês o valor das parcelas que vão encerrando.
    if (poupancaReal !== undefined || poupancaAcumulada) {
      buildProjection(poupancaAcumulada, poupancaReal, compromissos).forEach(d => {
        const e = map.get(d.mes);
        map.set(d.mes, { ...(e ?? { mes: d.mes }), projecao: d.projecao });
      });
    }

    // Ponte: último mês do histórico recebe o valor acumulado como ponto inicial
    // da linha de projeção, conectando as duas linhas visualmente
    const historicoEntries = Array.from(map.values()).filter(e => e.historico !== undefined);
    if (historicoEntries.length > 0 && poupancaAcumulada) {
      const last = historicoEntries[historicoEntries.length - 1];
      map.set(last.mes, { ...last, projecao: poupancaAcumulada });
    }

    return Array.from(map.values());
  }, [historico, poupancaAcumulada, summary.ganhoTudo, varPrevTotal, compromissos, data]);

  const dataAtual = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <ModuleHeader title="Visão Geral" />
      <Navigation />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          background: "rgba(17,24,39,0.95)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#f0f0f8", padding: "10px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 600, zIndex: 999, whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <header className={styles.header}>
        <div>
          <h1>Finanças Pessoais</h1>
          <p style={{ textTransform: "capitalize" }}>{dataAtual}</p>
        </div>
        <button
          onClick={refetch}
          className={styles.addBtn}
          style={{
            background: "rgba(255,255,255,0.05)",
            color: "var(--text-secondary)",
            borderColor: "rgba(255,255,255,0.1)",
            fontSize: 13,
          }}
        >
          ↻ Atualizar
        </button>
      </header>

      {loading && <div className={styles.loading}>Carregando...</div>}

      {error && !loading && (
        <div className={styles.errorCard}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>⚠ Erro ao carregar</p>
          <p style={{ fontSize: 12, opacity: 0.7 }}>{error}</p>
          <button onClick={refetch} className={styles.retryBtn}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && data && (
        <div className={styles.body}>

          {/* ════ Coluna esquerda ════ */}
          <div className={styles.mainCol} style={{ padding: "0 0 80px" }}>

            {/* ── Stat Cards ── */}
            <div style={{ marginBottom: 36, padding: "20px 28px 0" }}>

              {/* Linha 1: Ganhos + Gastos até agora */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {[
                  { label: "Ganhos",           icon: "💰", value: summary.ganhoTudo, color: "#10b981" },
                  { label: "Gastos até agora", icon: "💸", value: gastosAteMomento,  color: "#ef4444" },
                ].map(s => (
                  <div key={s.label} className="fin-stat-card">
                    <span className="fin-stat-icon">{s.icon}</span>
                    <span className="fin-stat-value" style={{ color: s.color }}>{fmt(s.value)}</span>
                    <span className="fin-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Linha 2: Poupança Real — destaque */}
              {(() => {
                const pos = poupancaReal >= 0;
                const cor = pos ? "#10b981" : "#ef4444";
                return (
                  <div style={{
                    padding: "18px 24px",
                    background: pos ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                    border: `1px solid ${pos ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)"}`,
                    borderRadius: 16,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 26 }}>🏦</span>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                          Poupança Real
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: cor, lineHeight: 1 }}>
                          {fmt(poupancaReal)}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", lineHeight: 1.6 }}>
                      <div>ganhos − gastos</div>
                      <div>mês atual</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── Gastos Variáveis ── */}
            <div style={{ marginBottom: 36, padding: "0 28px" }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 18,
              }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                  Gastos Variáveis
                </h2>
                <button
                  onClick={() => setAddModal(true)}
                  style={{
                    fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 99,
                    background: "rgba(0,229,160,0.1)", color: "var(--accent-primary)",
                    border: "1px solid rgba(0,229,160,0.25)", cursor: "pointer",
                  }}
                >
                  + Registrar
                </button>
              </div>

              {variaveis.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
                  Sem gastos variáveis cadastrados.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {variaveis.map(item => {
                    const pct        = item.previsao > 0 ? Math.round((item.real / item.previsao) * 100) : 0;
                    const overBudget = item.real > item.previsao;
                    const diff       = Math.abs(item.real - item.previsao);
                    const barColor   = budgetBarColor(pct);

                    return (
                      <div key={item.item} style={{
                        padding: "14px 18px", borderRadius: 14,
                        background: overBudget ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.03)",
                        border: overBudget ? "1px solid rgba(239,68,68,0.15)" : "1px solid rgba(255,255,255,0.07)",
                        borderLeft: `3px solid ${barColor}`,
                      }}>
                        <div style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "baseline", marginBottom: 10,
                        }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                            {item.item}
                          </span>
                          <span style={{
                            fontSize: 13, color: "var(--text-muted)",
                            fontFamily: "var(--font-mono)", whiteSpace: "nowrap",
                          }}>
                            {fmt(item.real)} <span style={{ opacity: 0.5 }}>/ {fmt(item.previsao)}</span>
                          </span>
                        </div>

                        <div style={{ height: 10, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                          <div style={{
                            height: "100%", width: `${Math.min(pct, 100)}%`,
                            background: barColor, borderRadius: 99, transition: "width 0.6s ease",
                          }} />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: overBudget ? "#ef4444" : "#10b981" }}>
                            {overBudget ? `↑ Ultrapassado ${fmt(diff)}` : `✓ Disponível ${fmt(diff)}`}
                          </span>
                          <span style={{
                            fontSize: 12, fontWeight: 800, fontFamily: "var(--font-mono)",
                            padding: "2px 10px", borderRadius: 99,
                            background: overBudget ? "rgba(239,68,68,0.12)" : pct >= 70 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)",
                            color: barColor,
                          }}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* ════ Coluna direita ════ */}
          <div className={styles.sideCol} style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: "none", overflowY: "visible" }}>

            {/* ── Saldo Variável + Donut de gastos ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 0 }}>

              {/* Saldo Disponível */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16, padding: "20px 16px",
                display: "flex", flexDirection: "column",
              }}>
                {/* ── Metade superior: Saldo Variável ── */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>
                    Saldo Variável
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: varColor, lineHeight: 1, marginBottom: 8 }}>
                      {fmt(varSaldo)}
                    </div>
                    {!hideNumbers && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {varSaldo < 0 ? "acima do previsto" : "disponível para gastar"}
                      </div>
                    )}
                  </div>
                  {/* Barra segmentada */}
                  {(() => {
                    const isOver    = varRealTotal > varPrevTotal;
                    const budgetW   = isOver ? (varPrevTotal / varRealTotal) * 100 : Math.min(varRawPct, 100);
                    const overflowW = isOver ? ((varRealTotal - varPrevTotal) / varRealTotal) * 100 : 0;
                    const overPct   = isOver ? Math.round(((varRealTotal - varPrevTotal) / varPrevTotal) * 100) : 0;
                    return (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)", marginBottom: 6 }}>
                          <span>0%</span>
                          {isOver && <span style={{ color: "#ef4444", fontWeight: 700 }}>+{overPct}% excedido</span>}
                          <span>100%</span>
                        </div>
                        <div style={{ height: 10, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden", display: "flex" }}>
                          {isOver ? (
                            <>
                              <div style={{ height: "100%", width: `${budgetW}%`, background: "#f59e0b", borderRadius: "99px 0 0 99px", flexShrink: 0, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }} />
                              <div style={{ height: "100%", width: `${overflowW}%`, background: "#ef4444", borderRadius: "0 99px 99px 0", flexShrink: 0, transition: "width 1s cubic-bezier(0.4,0,0.2,1) 0.8s" }} />
                            </>
                          ) : (
                            <div style={{ height: "100%", width: `${budgetW}%`, background: varColor, borderRadius: 99, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }} />
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Divisor */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 0" }} />

                {/* ── Metade inferior: Dias Restantes (ciclo financeiro) ── */}
                {(() => {
                  const now        = new Date();
                  const today      = now.getDate();
                  const melhorDia  = data?.config?.melhorDiaCompra;

                  let daysLeft, totalDays, pctElapsed;

                  if (melhorDia) {
                    const lastDay   = melhorDia - 1;
                    // Define início e fim do ciclo financeiro atual
                    const endDate   = today < melhorDia
                      ? new Date(now.getFullYear(), now.getMonth(), lastDay)
                      : new Date(now.getFullYear(), now.getMonth() + 1, lastDay);
                    const startDate = today < melhorDia
                      ? new Date(now.getFullYear(), now.getMonth() - 1, melhorDia)
                      : new Date(now.getFullYear(), now.getMonth(), melhorDia);
                    const todayMs   = new Date(now.getFullYear(), now.getMonth(), today).getTime();
                    const startMs   = startDate.getTime();
                    const endMs     = endDate.getTime();

                    daysLeft   = Math.max(0, Math.round((endMs - todayMs) / 86400000));
                    totalDays  = Math.round((endMs - startMs) / 86400000);
                    pctElapsed = totalDays > 0 ? Math.min(100, Math.round(((todayMs - startMs) / (endMs - startMs)) * 100)) : 0;
                  } else {
                    // Fallback: mês calendário
                    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                    daysLeft   = daysInMonth - today;
                    totalDays  = daysInMonth;
                    pctElapsed = Math.round((today / daysInMonth) * 100);
                  }

                  const dayColor = daysLeft <= 3 ? "#ef4444" : daysLeft <= 7 ? "#f59e0b" : "var(--text-primary)";
                  const barColor = daysLeft <= 3 ? "#ef4444" : daysLeft <= 7 ? "#f59e0b" : "var(--accent-primary)";

                  return (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center", marginBottom: 10 }}>
                        {melhorDia ? `Ciclo até dia ${melhorDia - 1}` : "Dias Restantes"}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5, marginBottom: 10 }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: dayColor, lineHeight: 1 }}>{daysLeft}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>de {totalDays} dias</span>
                      </div>
                      <div style={{ height: 7, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pctElapsed}%`, background: barColor, borderRadius: 99, transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Donut: gastos por grupo */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16, padding: "16px 14px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Gastos por Grupo
                </div>
                {donutData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={155}>
                      <PieChart>
                        <Pie
                          data={donutData} cx="50%" cy="50%"
                          innerRadius={36} outerRadius={56}
                          dataKey="value" strokeWidth={0}
                          animationBegin={200} animationDuration={800}
                          label={({ cx, cy, midAngle, outerRadius, percent }) => {
                            if (percent < 0.05) return null;
                            const R = Math.PI / 180;
                            const r = outerRadius + 18;
                            const x = cx + r * Math.cos(-midAngle * R);
                            const y = cy + r * Math.sin(-midAngle * R);
                            return (
                              <text x={x} y={y} fill="#9ca3af" textAnchor={x > cx ? "start" : "end"}
                                dominantBaseline="central" fontSize={10} fontWeight={700}>
                                {`${Math.round(percent * 100)}%`}
                              </text>
                            );
                          }}
                          labelLine={false}
                        >
                          {donutData.map((d, i) => (
                            <Cell key={i} fill={DONUT_COLORS[d.name] ?? "#6b7280"} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "#1f2937", border: "1px solid rgba(55,65,81,0.7)", borderRadius: 8, fontSize: 11, padding: "6px 10px" }}
                          formatter={v => fmt(v)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "5px 20px" }}>
                        {donutData.map(d => (
                          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[d.name] ?? "#6b7280", flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{d.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>Sem dados</p>
                )}
              </div>
            </div>


            {/* ── Projeção de Poupança ── */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "14px 10px 10px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, paddingLeft: 4 }}>
                Projeção de Poupança
              </div>
              {chartData.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>Sem dados ainda.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 4, right: 6, left: 0, bottom: 42 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_LINE} />
                      <XAxis dataKey="mes" tick={AXIS_TICK} angle={-35} textAnchor="end" interval={chartData.length > 12 ? 2 : 0} />
                      <YAxis tick={AXIS_TICK} tickFormatter={v => `R$${(Number(v)/1000).toFixed(0)}k`} width={44} />
                      <Tooltip contentStyle={TOOLTIP_CS} labelStyle={{ color: "#9ca3af" }}
                        formatter={(v, name) => [Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:0,maximumFractionDigits:0}), name === "historico" ? "Poupança" : "Projeção"]} />
                      <ReferenceLine x={mesAtualLabel} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 3"
                        label={{ value: "hoje", position: "insideTopRight", fontSize: 9, fill: "rgba(255,255,255,0.3)" }} />
                      <Line type="monotone" dataKey="historico" stroke="#10b981" strokeWidth={2} connectNulls={false}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          if (!payload.historico && payload.historico !== 0) return null;
                          return <circle key={`h${cx}${cy}`} cx={cx} cy={cy} r={3} fill={payload.atingido ? "#10b981" : "#111827"} stroke={payload.atingido ? "#10b981" : "#6b7280"} strokeWidth={2} />;
                        }}
                        activeDot={{ r: 5, fill: "#10b981", stroke: "#0a0d14", strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="projecao" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" connectNulls={false} dot={false}
                        activeDot={{ r: 4, fill: "#3b82f6", stroke: "#0a0d14", strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: 10, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>
                    <span><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", marginRight: 4, verticalAlign: "middle" }} />Histórico</span>
                    <span><span style={{ display: "inline-block", width: 16, height: 2, background: "#3b82f6", marginRight: 4, verticalAlign: "middle", borderRadius: 1 }} />Projeção</span>
                  </div>
                </>
              )}
            </div>

            {/* ── Meta de Poupança ── */}
            {(() => {
              const metaFinal  = poupanca.meta ?? 50_000;
              const pct        = Math.min(poupancaAcumulada / metaFinal, 1);
              const pctLabel   = Math.round(pct * 100);
              const faltam     = Math.max(metaFinal - poupancaAcumulada, 0);
              const cor        = pctLabel >= 80 ? "#10b981" : pctLabel >= 50 ? "#3b82f6" : "#f59e0b";

              const taxaMensal    = Math.max(poupancaReal, 0);
              const previsaoLabel = taxaMensal > 0 && faltam > 0 ? (() => {
                const d = new Date();
                d.setMonth(d.getMonth() + Math.ceil(faltam / taxaMensal));
                return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
              })() : null;

              // SVG meio círculo — sweep-flag=1 (horário) desenha pelo topo do arco
              const cx = 110, cy = 88, R = 70, sw = 12;
              // Background: único arco de 180° pelo topo (large-arc=0, sweep=1)
              const bgArc = `M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`;
              // Fill: arco do ponto esquerdo até a posição proporcional, sempre pelo topo
              const angle = Math.PI * (1 - Math.min(pct, 0.9999));
              const ex = (cx + R * Math.cos(angle)).toFixed(1);
              const ey = (cy - R * Math.sin(angle)).toFixed(1);

              return (
                <div className={styles.savingsHero} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", marginBottom: 0 }}>

                  {/* Cabeçalho */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Meta de Poupança
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Meta: <strong style={{ color: "var(--text-secondary)" }}>{fmtShort(metaFinal)}</strong>
                    </span>
                  </div>

                  {/* Gauge meio círculo */}
                  <svg width="100%" viewBox="0 0 220 104" style={{ display: "block" }}>
                    {/* Trilha (dois 90° para evitar ambiguidade de 180°) */}
                    <path d={bgArc}
                      fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={sw} strokeLinecap="round" />
                    {/* Preenchimento (large-arc sempre 0) */}
                    {pct > 0 && (
                      <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${ex} ${ey}`}
                        fill="none" stroke={cor} strokeWidth={sw} strokeLinecap="round" />
                    )}
                    {/* % */}
                    <text x={cx} y={cy-34} textAnchor="middle" fill={cor} fontSize="12" fontWeight="800">{pctLabel}%</text>
                    {/* Valor acumulado */}
                    <text x={cx} y={cy-16} textAnchor="middle" fill="#f9fafb" fontSize="16" fontWeight="900">{fmtShort(poupancaAcumulada)}</text>
                    {/* Sublabel */}
                    <text x={cx} y={cy-4} textAnchor="middle" fill="#6b7280" fontSize="9">acumulado</text>
                    {/* Marcadores 0 e meta */}
                    <text x={cx-R+2} y={cy+12} textAnchor="middle" fill="#4b5563" fontSize="9">R$0</text>
                    <text x={cx+R-2} y={cy+12} textAnchor="middle" fill="#4b5563" fontSize="9">50k</text>
                  </svg>

                  {/* Faltam + previsão */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Faltam</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: faltam > 0 ? "var(--text-secondary)" : "#10b981" }}>
                        {faltam > 0 ? fmtShort(faltam) : "Meta! 🎉"}
                      </div>
                    </div>
                    {previsaoLabel && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Previsão</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#6b7280" }}>{previsaoLabel}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>

        </div>
      )}

      {/* ── Modal de registro de gasto ── */}
      {addModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end",
            justifyContent: "center", zIndex: 500,
          }}
          onClick={() => setAddModal(false)}
        >
          <div
            style={{
              background: "rgba(17,24,39,0.98)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "20px 20px 0 0", padding: "28px 20px 44px",
              width: "100%", maxWidth: 600,
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Registrar gasto variável</h3>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 20 }}>
              Selecione a categoria e informe o valor — será somado ao total do dia.
            </p>
            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{
                  fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8,
                }}>
                  Categoria
                </label>
                <div className={styles.catGrid}>
                  {cats.length > 0 ? cats.map(c => (
                    <button
                      key={c.name} type="button"
                      onClick={() => setAddCat(c.name)}
                      className={`${styles.catBtn} ${addCat === c.name ? styles.catBtnActive : ""}`}
                    >
                      {c.name}
                      <span className={`${styles.catBtnRest} ${addCat === c.name ? styles.catBtnRestActive : ""}`}>
                        {fmt(c.restante)} restam
                      </span>
                    </button>
                  )) : (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", gridColumn: "1 / -1" }}>
                      Nenhuma categoria variável disponível.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8,
                }}>
                  Valor (R$)
                </label>
                <input
                  type="number" step="0.01" min="0.01"
                  value={addVal} onChange={e => setAddVal(e.target.value)}
                  placeholder="0,00" required
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                    padding: "12px 14px", color: "#f0f0f8", fontSize: 18,
                    fontFamily: "var(--font-mono), monospace", outline: "none",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setAddModal(false); setAddCat(""); setAddVal(""); }}
                  style={{
                    flex: 1, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600,
                    color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !addCat || !addVal}
                  style={{
                    flex: 2, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 700,
                    color: "#fff", background: "linear-gradient(135deg,#10b981,#059669)",
                    border: "none", opacity: (!addCat || !addVal || saving) ? 0.5 : 1,
                  }}
                >
                  {saving ? "Salvando..." : "Salvar na planilha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
