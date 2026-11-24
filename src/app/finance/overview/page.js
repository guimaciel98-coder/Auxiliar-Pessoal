"use client";
import { useState, useMemo, useEffect } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "../Finance.module.css";
import { useFinance } from "@/hooks/useFinance";
import { fmtFin } from "@/lib/fmtFin";
import FinanceOcultarBtn from "@/components/ui/FinanceOcultarBtn";
import { KpisB, VarsB } from "./OverviewLeft";
import { RightB, ProjectionPanel } from "./OverviewRight";

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

  // ── Rosca por tema: para onde o dinheiro vai ─────────────────────────────────
  // Fixos entram inteiros (pagos ou não); variáveis pelo que já foi gasto no ciclo; parcelas pela parcela do mês.
  const DONUT_COLORS = {
    "Alimentação": "#34d399", "Moradia": "#38bdf8", "Apartamento novo": "#fbbf24", "Parcelas": "#a78bfa",
    "Livre": "#f472b6", "Contas pessoais": "#cbd5e1", "Pito": "#fb923c", "Transporte": "#fb7185",
  };

  const donutData = useMemo(() => {
    const t = Object.fromEntries(Object.keys(DONUT_COLORS).map(k => [k, 0]));

    // Fixos: Casa → Moradia, Casa Nova → Apartamento novo, resto → Contas pessoais
    for (const item of data?.gastos?.fixos?.items ?? []) {
      if (!item.real || item.item.includes("Até")) continue;
      const g = (item.grupo ?? "").toLowerCase();
      t[g === "casa" ? "Moradia" : g === "casa nova" ? "Apartamento novo" : "Contas pessoais"] += item.real;
    }

    // Variáveis: pelo nome da categoria (categoria nova cai em Contas pessoais até entrar na regra)
    const VAR_TEMA = { "mercado": "Alimentação", "comida": "Alimentação", "pito": "Pito", "transporte": "Transporte", "outros (disponível)": "Livre" };
    for (const item of data?.gastos?.variaveis?.items ?? []) {
      if (!item.real) continue;
      t[VAR_TEMA[String(item.item).toLowerCase()] ?? "Contas pessoais"] += item.real;
    }

    // Parcelas ativas
    for (const c of data?.compromissos?.items ?? []) {
      if (c.valorMensal) t.Parcelas += c.valorMensal;
    }

    return Object.entries(t)
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

  // ── Coluna direita: valores compartilhados pelas versões B/C ──────────────
  const rightCycle = (() => {
    const now = new Date(); const today = now.getDate();
    const melhorDia = data?.config?.melhorDiaCompra; const cicloInicio = data?.config?.cicloInicio;
    let daysLeft, pctElapsed;
    if (melhorDia) {
      const lastDay = melhorDia - 1; let startDate, endDate;
      if (cicloInicio) {
        const [ciDd, ciMm, ciYyyy] = cicloInicio.split("/").map(Number);
        startDate = new Date(ciYyyy, ciMm - 1, ciDd);
        endDate   = new Date(ciMm === 12 ? ciYyyy + 1 : ciYyyy, ciMm % 12, lastDay);
      } else {
        endDate   = today < melhorDia ? new Date(now.getFullYear(), now.getMonth(), lastDay) : new Date(now.getFullYear(), now.getMonth() + 1, lastDay);
        startDate = today < melhorDia ? new Date(now.getFullYear(), now.getMonth() - 1, melhorDia) : new Date(now.getFullYear(), now.getMonth(), melhorDia);
      }
      const todayMs = new Date(now.getFullYear(), now.getMonth(), today).getTime();
      const startMs = startDate.getTime(), endMs = endDate.getTime();
      daysLeft   = Math.max(0, Math.round((endMs - todayMs) / 86400000) + 1);
      pctElapsed = endMs > startMs ? Math.min(100, Math.max(0, Math.round(((todayMs - startMs) / (endMs - startMs)) * 100))) : 0;
    } else {
      const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      daysLeft = dim - today + 1; pctElapsed = Math.round((today / dim) * 100);
    }
    const color = daysLeft <= 3 ? "#fb7185" : daysLeft <= 7 ? "#fbbf24" : "#34d399";
    return { daysLeft, pctElapsed, color, endLabel: melhorDia ? `até dia ${melhorDia - 1}` : "fim do mês" };
  })();
  const rightSaldo = (() => {
    const isOver = varRealTotal > varPrevTotal;
    return {
      value: varSaldo, color: varColor, rawPct: varRawPct, isOver,
      budgetW: isOver ? (varPrevTotal / varRealTotal) * 100 : Math.min(varRawPct, 100),
      overflowW: isOver ? ((varRealTotal - varPrevTotal) / varRealTotal) * 100 : 0,
      overPct: isOver && varPrevTotal > 0 ? Math.round(((varRealTotal - varPrevTotal) / varPrevTotal) * 100) : 0,
    };
  })();
  const rightMeta = (() => {
    const final = poupanca.meta ?? 50_000;
    const pct = Math.round(Math.min(poupancaAcumulada / final, 1) * 100);
    return { final, acumulado: poupancaAcumulada, pct, falta: Math.max(final - poupancaAcumulada, 0),
      color: pct >= 80 ? "#34d399" : pct >= 50 ? "#38bdf8" : "#fbbf24" };
  })();

  const dataAtual = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.container} style={{ background: "radial-gradient(50% 35% at 85% 0%, rgba(52,211,153,0.08), transparent 70%), #07080c" }}>
      <ModuleHeader title="Visão Geral" hideOnDesktop />
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
      <header className={styles.header} style={{ alignItems: "flex-end", paddingTop: 26 }}>
        <div>
          <p style={{ textTransform: "capitalize", fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{dataAtual}</p>
          <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1, color: "#fff", margin: 0 }}>Finanças Pessoais</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <FinanceOcultarBtn className={styles.addBtn} />
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
        </div>
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
          <div className={styles.mainCol} style={{ padding: "0 0 20px" }}>

            {/* ── Números + gastos variáveis (estilo minimalista) ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 28, padding: isMobile ? "16px 16px 0" : "20px 28px 0" }}>
              <KpisB
                fmt={fmt}
                ganhos={summary.ganhoTudo ?? 0}
                gastos={gastosAteMomento}
                poupancas={[
                  { label: "Previsão (CLT)", value: poupancaPrevCLT,    hint: "renda fixa − gastos previstos" },
                  { label: "Previsão total", value: poupancaMensalBase, hint: "todos os ganhos − previstos" },
                  { label: "Poupança real",  value: poupancaReal,       hint: "ganhos confirmados − gastos" },
                ]}
              />
              <VarsB fmt={fmt} variaveis={variaveis} barColor={budgetBarColor} />
            </div>

          </div>

          {/* ════ Coluna direita ════ */}
          <div className={`${styles.sideCol} ${styles.sideColMobileShow}`} style={{ position: "static", maxHeight: "none", overflowY: "visible", paddingBottom: 20 }}>
            <RightB fmt={fmt} fmtShort={fmtShort} saldo={rightSaldo} cycle={rightCycle} meta={rightMeta}
              donutData={donutData} donutColors={DONUT_COLORS} />

          </div>

          {/* ════ Projeção de poupança — largura toda ════ */}
          <div style={{ gridColumn: "1 / -1", padding: isMobile ? "0 16px 100px" : "0 24px 80px 28px" }}>
            <ProjectionPanel chartData={chartData} mesAtualLabel={mesAtualLabel} height={isMobile ? 240 : 320} fmtShort={fmtShort} />
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
                    color: "#fff", background: "linear-gradient(135deg,#34d399,#059669)",
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
