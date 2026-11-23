"use client";
import { useState, useMemo, useEffect } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "../Finance.module.css";
import ov from "./Overview.module.css";
import Ring from "@/components/ui/Ring";
import { useFinance } from "@/hooks/useFinance";
import { fmtFin } from "@/lib/fmtFin";
import FinanceOcultarBtn from "@/components/ui/FinanceOcultarBtn";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell,
} from "recharts";

// ── Formatadores ──────────────────────────────────────────────────────────────
function budgetBarColor(pct) {
  if (pct >= 100) return "#fb7185";
  if (pct >= 70)  return "#fbbf24";
  return "#34d399";
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

const AXIS_TICK  = { fill: "rgba(255,255,255,0.4)", fontSize: 11 };
const GRID_LINE  = "rgba(255,255,255,0.06)";
const TOOLTIP_CS = {
  background: "#15161f", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12, fontSize: 12, padding: "8px 12px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
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
 * buildProjection — projeta poupança mês a mês até PROJ_FIM (dez/27).
 *
 * Fórmula por mês:
 *   mensal = poupancaRealBase + freed - lostIncome
 *   freed       = soma das parcelas (gastos) que JÁ encerraram ANTES deste mês
 *   lostIncome  = soma dos ganhos com prazo (empréstimos) que JÁ encerraram ANTES deste mês
 *
 * poupancaRealBase já inclui o custo de todas as parcelas ativas e o
 * recebimento de todos os empréstimos confirmados agora. Conforme cada
 * parcela encerra, seu valorMensal é somado ao freed (sobra mais);
 * conforme cada empréstimo encerra, seu valor é subtraído (sobra menos).
 */
// Último mês coberto pela projeção de poupança
const PROJ_FIM = { mes: 12, ano: 2027 };

function buildProjection(acumulado, poupancaRealBase, commitments, incomeCommitments = [], firstMonthValue = null) {
  const now   = new Date();
  // Começa do mês atual — ele ainda não fechou no histórico, então a projeção
  // precisa cobri-lo (senão fica um buraco entre o último mês fechado e o próximo)
  let   month = now.getMonth() + 1;
  let   year  = now.getFullYear();
  let   running = acumulado;
  const result  = [];
  let   isFirst = true;

  // Simula até PROJ_FIM
  while (year < PROJ_FIM.ano || (year === PROJ_FIM.ano && month <= PROJ_FIM.mes)) {
    // Valor acumulado das parcelas que já encerraram ANTES deste mês
    const freed = commitments.reduce((s, c) => {
      const p = parsePrazo(c.prazo);
      if (!p) return s;
      const jaEncerrou = (p.ano < year) || (p.ano === year && p.mes < month);
      return jaEncerrou ? s + c.valorMensal : s;
    }, 0);

    // Valor acumulado dos empréstimos que já encerraram ANTES deste mês
    const lostIncome = incomeCommitments.reduce((s, c) => {
      const p = parsePrazo(c.prazo);
      if (!p) return s;
      const jaEncerrou = (p.ano < year) || (p.ano === year && p.mes < month);
      return jaEncerrou ? s + c.valor : s;
    }, 0);

    if (isFirst && firstMonthValue !== null) {
      // Mês atual usa a Poupança Real (o que realmente aconteceu até agora)
      running += firstMonthValue;
    } else {
      running += poupancaRealBase + freed - lostIncome;
    }
    isFirst = false;

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

  // Detecta mobile para ajustes de padding/margens — sem afetar desktop
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const check = () => setIsMobile(mq.matches);
    check();
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
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
      refetch(true);
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

  // Empréstimos confirmados com prazo — contam em ganhoTudo agora, mas deixam
  // de contar na projeção a partir do mês em que o prazo encerra.
  const emprestimosComPrazo = (data?.ganhos?.items?.emprestimos ?? [])
    .filter(e => e.confirmado && e.prazo);

  // ── Saldo Disponível (variáveis) — definido antes de gastosAteMomento ────
  const varPrevTotal = data?.gastos?.variaveis?.previsaoTotal ?? variaveis.reduce((s,i) => s + (i.previsao||0), 0);
  const varRealTotal = data?.gastos?.variaveis?.realTotal ?? 0;
  const varSaldo  = varPrevTotal - varRealTotal;
  const varPct    = varPrevTotal > 0 ? Math.min(Math.round((varRealTotal / varPrevTotal) * 100), 100) : 0;
  const varRawPct = varPrevTotal > 0 ? Math.round((varRealTotal / varPrevTotal) * 100) : 0;
  const varColor  = varSaldo < 0 ? "#fb7185" : varRawPct >= 70 ? "#fbbf24" : "#34d399";

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
  const poupancaReal     = (summary.ganhoConfirmado ?? summary.ganhoTudo ?? 0) - gastosAteMomento;

  // Para projeção: variáveis consideradas como totalmente pagas no orçamento (real se excedeu)
  const todosFixosMensal   = (data?.gastos?.fixos?.items ?? [])
    .filter(i => !i.item.includes("Até"))
    .reduce((s, i) => s + i.real, 0);
  const varParaProjecao    = varPrevTotal;
  const poupancaMensalBase = (summary.ganhoTotal ?? summary.ganhoTudo ?? 0) - todosFixosMensal - varParaProjecao - gastosParcelasMes;
  // Previsão só com renda fixa (CLT + empréstimos) — sem PDV variável
  const poupancaPrevCLT = ((data?.ganhos?.clt ?? 0) + (data?.ganhos?.emprestimosTotal ?? data?.ganhos?.emprestimos ?? 0))
    - todosFixosMensal - varParaProjecao - gastosParcelasMes;

  // Poupança acumulada — último mês atingido (valor já é acumulado na planilha)
  const historico         = savingsData?.historico ?? poupanca.historico ?? [];
  const poupancaAcumulada = savingsData?.acumulado
    ?? (() => { const a = historico.filter(m => m.atingido); return a.length ? a[a.length-1].valor : 0; })();
  const mesesAtingidos    = historico.filter(m => m.atingido).length;

  // ── Donut por grupo (Casa Nova / Casa / Pessoal / Outros / Parcelas) ────────
  const DONUT_COLORS = { "Casa Nova": "#fbbf24", Casa: "#38bdf8", Pessoal: "#34d399", Outros: "#94a3b8", Parcelas: "#a78bfa" };

  const donutData = useMemo(() => {
    const groups = { "Casa Nova": 0, Casa: 0, Pessoal: 0, Outros: 0, Parcelas: 0 };

    // Fixos pelo valor real (todos, pagos ou não), excluindo parcelas antigas ("Até")
    for (const item of data?.gastos?.fixos?.items ?? []) {
      if (!item.real || item.item.includes("Até")) continue;
      const g = (item.grupo ?? "").toLowerCase();
      if      (g === "casa nova") groups["Casa Nova"] += item.real;
      else if (g === "casa")      groups.Casa         += item.real;
      else if (g === "pessoal")   groups.Pessoal      += item.real;
      else                        groups.Outros        += item.real;
    }

    // Variáveis: usa o real do ciclo atual — cada item vai para o grupo correto
    const VAR_GRUPO = {
      "Mercado":           "Casa",
      "Comida":            "Pessoal",
      "Pito":              "Pessoal",
      "Psicologa":         "Pessoal",
      "Outros (Disponível)": "Pessoal",
      "Transporte":        "Outros",
    };
    for (const item of data?.gastos?.variaveis?.items ?? []) {
      if (!item.real) continue;
      const grupo = VAR_GRUPO[item.item] ?? "Outros";
      groups[grupo] += item.real;
    }

    // Parcelas ativas
    for (const c of data?.compromissos?.items ?? []) {
      if (c.valorMensal) groups.Parcelas += c.valorMensal;
    }

    return Object.entries(groups)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value: Math.round(value) }));
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
    if (poupancaMensalBase !== undefined || poupancaAcumulada) {
      // Só usa poupancaReal no primeiro mês quando há excedente nos gastos variáveis
      const firstMonthOverride = varRealTotal > varPrevTotal ? poupancaReal : null;
      buildProjection(poupancaAcumulada, poupancaMensalBase, compromissos, emprestimosComPrazo, firstMonthOverride).forEach(d => {
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
  }, [historico, poupancaAcumulada, summary.ganhoTudo, varPrevTotal, varRealTotal, gastosParcelasMes, poupancaMensalBase, compromissos, emprestimosComPrazo, data]);

  const dataAtual = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  // ── Ciclo financeiro: dias restantes (mesma regra de antes) ──────────────
  const cycle = (() => {
    const now         = new Date();
    const today       = now.getDate();
    const melhorDia   = data?.config?.melhorDiaCompra;
    const cicloInicio = data?.config?.cicloInicio; // "DD/MM/YYYY"
    let daysLeft, totalDays, pctElapsed;
    if (melhorDia) {
      const lastDay = melhorDia - 1;
      let startDate, endDate;
      if (cicloInicio) {
        const [ciDd, ciMm, ciYyyy] = cicloInicio.split("/").map(Number);
        startDate = new Date(ciYyyy, ciMm - 1, ciDd);
        // Fim: lastDay do mês seguinte ao início do ciclo
        const endMon = ciMm % 12;
        const endYr  = ciMm === 12 ? ciYyyy + 1 : ciYyyy;
        endDate = new Date(endYr, endMon, lastDay);
      } else {
        endDate   = today < melhorDia ? new Date(now.getFullYear(), now.getMonth(), lastDay) : new Date(now.getFullYear(), now.getMonth() + 1, lastDay);
        startDate = today < melhorDia ? new Date(now.getFullYear(), now.getMonth() - 1, melhorDia) : new Date(now.getFullYear(), now.getMonth(), melhorDia);
      }
      const todayMs = new Date(now.getFullYear(), now.getMonth(), today).getTime();
      const startMs = startDate.getTime();
      const endMs   = endDate.getTime();
      // +1 porque o último dia do ciclo também conta
      daysLeft   = Math.max(0, Math.round((endMs - todayMs) / 86400000) + 1);
      totalDays  = Math.round((endMs - startMs) / 86400000);
      pctElapsed = totalDays > 0 ? Math.min(100, Math.max(0, Math.round(((todayMs - startMs) / (endMs - startMs)) * 100))) : 0;
    } else {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      daysLeft   = daysInMonth - today + 1;
      totalDays  = daysInMonth;
      pctElapsed = Math.round((today / daysInMonth) * 100);
    }
    const color = daysLeft <= 3 ? "#fb7185" : daysLeft <= 7 ? "#fbbf24" : "#34d399";
    return { daysLeft, totalDays, pctElapsed, color, endLabel: melhorDia ? `até dia ${melhorDia - 1}` : "fim do mês" };
  })();

  // Barra do saldo variável: orçamento + excesso
  const varIsOver    = varRealTotal > varPrevTotal;
  const varBudgetW   = varIsOver ? (varPrevTotal / varRealTotal) * 100 : Math.min(varRawPct, 100);
  const varOverflowW = varIsOver ? ((varRealTotal - varPrevTotal) / varRealTotal) * 100 : 0;
  const varOverPct   = varIsOver && varPrevTotal > 0 ? Math.round(((varRealTotal - varPrevTotal) / varPrevTotal) * 100) : 0;

  // Meta de poupança
  const metaFinal = poupanca.meta ?? 50_000;
  const metaPct   = Math.min(poupancaAcumulada / metaFinal, 1);
  const metaLabel = Math.round(metaPct * 100);
  const metaFalta = Math.max(metaFinal - poupancaAcumulada, 0);
  const metaCor   = metaLabel >= 80 ? "#34d399" : metaLabel >= 50 ? "#38bdf8" : "#fbbf24";

  const KPIS = [
    { label: "Ganhos",            value: summary.ganhoTudo, color: "#34d399", hint: "do ciclo" },
    { label: "Gastos até agora",  value: gastosAteMomento,  color: "#fb7185", hint: "variáveis + fixos pagos + parcelas" },
    { label: "Poupança real",     value: poupancaReal,      sign: true, hint: "ganhos confirmados − gastos" },
    { label: "Previsão (CLT)",    value: poupancaPrevCLT,   sign: true, hint: "renda fixa − gastos previstos" },
    { label: "Previsão total",    value: poupancaMensalBase, sign: true, hint: "todos os ganhos − previstos" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={ov.page}>
      <ModuleHeader title="Visão Geral" hideOnDesktop />
      <Navigation />

      {/* Toast */}
      {toast && <div className={ov.toast}>{toast}</div>}

      {/* ── Cabeçalho ── */}
      <header className={ov.top}>
        <div className={ov.topLeft}>
          <span className={ov.eyebrow}>Financeiro · {dataAtual}</span>
          <h1 className={ov.title}>Visão Geral</h1>
        </div>
        <div className={ov.topRight}>
          <FinanceOcultarBtn className={ov.pillBtn} />
          <button onClick={refetch} className={ov.iconBtn} title="Atualizar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
          </button>
        </div>
      </header>

      {loading && <div className={ov.loading}>Carregando…</div>}

      {error && !loading && (
        <div className={ov.errorBox}>
          <p><b>Erro ao carregar.</b> {error}</p>
          <button onClick={refetch} className={ov.retryBtn}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && data && (
        <main className={ov.grid}>

          {/* ── Números do ciclo ── */}
          <section className={ov.kpis}>
            {KPIS.map(k => {
              const color = k.sign ? (k.value >= 0 ? "#34d399" : "#fb7185") : k.color;
              return (
                <div key={k.label} className={ov.kpi} style={{ "--k": color }}>
                  <span className={ov.kpiLabel}><span className={ov.kpiDot} />{k.label}</span>
                  <span className={ov.kpiValue} style={{ color }}>{fmt(k.value)}</span>
                  <span className={ov.kpiHint}>{k.hint}</span>
                </div>
              );
            })}
          </section>

          {/* ── Coluna esquerda ── */}
          <div className={ov.colMain}>

            {/* Saldo variável + ciclo */}
            <section className={`${ov.panel} ${ov.saldo}`} style={{ "--v": varColor }}>
              <div className={ov.saldoMain}>
                <Ring pct={varRawPct} color={varColor} size={150} stroke={13}>
                  <span className={ov.ringPct}>{varRawPct}%</span>
                  <span className={ov.ringSub}>do orçamento</span>
                </Ring>
                <div className={ov.saldoInfo}>
                  <span className={ov.panelLabel}>Saldo variável</span>
                  <span className={ov.saldoValue} style={{ color: varColor }}>{fmt(varSaldo)}</span>
                  <span className={ov.saldoHint}>
                    {varSaldo < 0 ? "acima do previsto" : "disponível para gastar"}
                    {varIsOver && !hideNumbers && <b className={ov.over}> · +{varOverPct}% excedido</b>}
                  </span>
                  <div className={ov.splitBar}>
                    <span style={{ width: `${varBudgetW}%`, background: varIsOver ? "#fbbf24" : varColor }} />
                    {varIsOver && <span style={{ width: `${varOverflowW}%`, background: "#fb7185" }} />}
                  </div>
                  <span className={ov.saldoFoot}>{fmt(varRealTotal)} gastos de {fmt(varPrevTotal)} previstos</span>
                </div>
              </div>

              <div className={ov.cycle}>
                <div className={ov.cycleNum}>
                  <span className={ov.cycleDays} style={{ color: cycle.color }}>{cycle.daysLeft}</span>
                  <span className={ov.cycleLbl}>dias para fechar<br />o ciclo ({cycle.endLabel})</span>
                </div>
                <div className={ov.cycleBarWrap}>
                  <div className={ov.cycleBar}><span style={{ width: `${cycle.pctElapsed}%`, background: cycle.color }} /></div>
                  <span className={ov.cyclePct}>{cycle.pctElapsed}% do ciclo</span>
                </div>
              </div>
            </section>

            {/* Gastos variáveis */}
            <section className={ov.panel}>
              <div className={ov.panelHead}>
                <h2 className={ov.panelTitle}>Gastos variáveis</h2>
                <span className={ov.panelCount}>{variaveis.length}</span>
              </div>
              {variaveis.length === 0 ? (
                <p className={ov.empty}>Sem gastos variáveis cadastrados.</p>
              ) : (
                <div className={ov.varList}>
                  {variaveis.map(item => {
                    const pct        = item.previsao > 0 ? Math.round((item.real / item.previsao) * 100) : 0;
                    const overBudget = item.real > item.previsao;
                    const diff       = Math.abs(item.real - item.previsao);
                    const barColor   = budgetBarColor(pct);
                    return (
                      <div key={item.item} className={ov.varRow} style={{ "--b": barColor }}>
                        <div className={ov.varTop}>
                          <span className={ov.varName}>{item.item}</span>
                          <span className={ov.varPct} style={{ color: barColor }}>{pct}%</span>
                        </div>
                        <div className={ov.varBar}><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                        <div className={ov.varBottom}>
                          <span className={ov.varVals}>{fmt(item.real)} <span>/ {fmt(item.previsao)}</span></span>
                          <span className={ov.varStatus} style={{ color: overBudget ? "#fb7185" : "#34d399" }}>
                            {overBudget ? `↑ ${fmt(diff)} acima` : `${fmt(diff)} livre`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ── Coluna direita ── */}
          <div className={ov.colSide}>

            {/* Gastos por grupo */}
            <section className={ov.panel}>
              <div className={ov.panelHead}>
                <h2 className={ov.panelTitle}>Gastos por grupo</h2>
              </div>
              {donutData.length > 0 ? (() => {
                const total = donutData.reduce((s, d) => s + d.value, 0);
                return (
                  <div className={ov.donutWrap}>
                    <div className={ov.donut}>
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie
                            data={donutData} cx="50%" cy="50%"
                            innerRadius={56} outerRadius={78} paddingAngle={2} cornerRadius={4}
                            dataKey="value" strokeWidth={0}
                            animationBegin={150} animationDuration={700}
                            labelLine={false}
                          >
                            {donutData.map((d, i) => (
                              <Cell key={i} fill={DONUT_COLORS[d.name] ?? "#6b7280"} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={TOOLTIP_CS}
                            formatter={(v, name) => [fmt(v), name]}
                            itemStyle={{ color: "#e5e7eb" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className={ov.donutCenter}>
                        <span className={ov.donutTotal}>{fmt(total)}</span>
                        <span className={ov.donutLbl}>total</span>
                      </div>
                    </div>
                    <div className={ov.legend}>
                      {[...donutData].sort((a, b) => b.value - a.value).map(d => {
                        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                        const cor = DONUT_COLORS[d.name] ?? "#6b7280";
                        return (
                          <div key={d.name} className={ov.legendRow}>
                            <span className={ov.legendDot} style={{ background: cor }} />
                            <span className={ov.legendName}>{d.name}</span>
                            <span className={ov.legendVal}>{fmt(d.value)}</span>
                            <span className={ov.legendPct} style={{ color: cor }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })() : (
                <p className={ov.empty}>Sem dados</p>
              )}
            </section>

            {/* Meta de poupança */}
            <section className={ov.panel}>
              <div className={ov.panelHead}>
                <h2 className={ov.panelTitle}>Meta de poupança</h2>
                <span className={ov.panelAside}>{fmtShort(metaFinal)}</span>
              </div>
              <div className={ov.meta}>
                <Ring pct={metaLabel} color={metaCor} size={132} stroke={12}>
                  <span className={ov.ringPct}>{metaLabel}%</span>
                  <span className={ov.ringSub}>da meta</span>
                </Ring>
                <div className={ov.metaInfo}>
                  <div>
                    <span className={ov.panelLabel}>Acumulado</span>
                    <span className={ov.metaValue}>{fmtShort(poupancaAcumulada)}</span>
                  </div>
                  <div>
                    <span className={ov.panelLabel}>Faltam</span>
                    <span className={ov.metaFalta} style={{ color: metaFalta > 0 ? "#fff" : "#34d399" }}>
                      {metaFalta > 0 ? fmtShort(metaFalta) : "Meta batida! 🎉"}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ── Projeção de poupança (largura toda) ── */}
          <section className={`${ov.panel} ${ov.wide}`}>
            <div className={ov.panelHead}>
              <h2 className={ov.panelTitle}>Projeção de poupança</h2>
              <div className={ov.chartLegend}>
                <span><i style={{ background: "#34d399" }} />Histórico</span>
                <span><i className={ov.dash} />Projeção</span>
              </div>
            </div>
            {chartData.length === 0 ? (
              <p className={ov.empty}>Sem dados ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gHist" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gProj" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_LINE} vertical={false} />
                  <XAxis dataKey="mes" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={isMobile ? 3 : chartData.length > 16 ? 1 : 0} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={v => `R$${(Number(v) / 1000).toFixed(0)}k`} width={48} />
                  <Tooltip contentStyle={TOOLTIP_CS} labelStyle={{ color: "#9ca3af" }}
                    formatter={(v, name) => [Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }), name === "historico" ? "Poupança" : "Projeção"]} />
                  <ReferenceLine x={mesAtualLabel} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 3"
                    label={{ value: "hoje", position: "insideTopRight", fontSize: 10, fill: "rgba(255,255,255,0.45)" }} />
                  <Area type="monotone" dataKey="projecao" stroke="#38bdf8" strokeWidth={2} strokeDasharray="6 4" fill="url(#gProj)" connectNulls={false} dot={false}
                    activeDot={{ r: 4, fill: "#38bdf8", stroke: "#07080c", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="historico" stroke="#34d399" strokeWidth={2.5} fill="url(#gHist)" connectNulls={false}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (!payload.historico && payload.historico !== 0) return null;
                      return <circle key={`h${cx}${cy}`} cx={cx} cy={cy} r={3.5} fill={payload.atingido ? "#34d399" : "#07080c"} stroke={payload.atingido ? "#34d399" : "#6b7280"} strokeWidth={2} />;
                    }}
                    activeDot={{ r: 5, fill: "#34d399", stroke: "#07080c", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </section>
        </main>
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
