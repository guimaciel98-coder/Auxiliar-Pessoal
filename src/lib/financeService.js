/**
 * financeService.js — Google Sheets API · Módulo Financeiro
 *
 * Todas as leituras usam exclusivamente as abas oficiais App_*:
 *
 *  App_Gastos_Fixos     A:Grupo | B:Item | C:Previsao | D:Real | E:Controle
 *  App_Gastos_Variaveis A:Grupo | B:Item | C:Previsao | D:Real | E:Controle
 *  App_Ganhos           A:Grupo | B:Item | C:Valor    | D:Confirmado
 *  App_Poupanca         A:Mes   | B:Valor| C:Atingido
 *  App_Parcelas         A:Nome  | B:Desc | C:ValorTotal | D:ValorMensal |
 *                       E:TotalParc | F:ParcelasPagas | G:DataInicio | H:Ativo | I:Auto
 *  App_Lancamentos      A:Data  | B:Desc | C:Categoria | D:Valor
 */

import { getSheetsClient, getSpreadsheetId } from "./googleSheets";

// ─── Constante de meta final de poupança ──────────────────────────────────────
const META_POUPANCA_FINAL = parseInt(process.env.META_POUPANCA ?? "50000");

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function parseNum(raw) {
  const s = String(raw ?? "0").trim().replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
}

// Converte "DD/MM/YYYY" → timestamp (meia-noite local)
function parseDateBR(s) {
  const [d, m, y] = String(s ?? "").trim().split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d).getTime() : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// fetchFinancialData — lê exclusivamente das abas App_*
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchFinancialData() {
  const sheets        = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const [fixosRes, variaveisRes, ganhosRes, poupancaRes, parcelasRes, configRes, lancRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Gastos_Fixos'!A2:F500" }), // F = Auto
    sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Gastos_Variaveis'!A2:E500" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Ganhos'!A2:D500" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Poupanca'!A2:C100" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Parcelas'!A2:I300" }).catch(() => ({ data: { values: [] } })),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Config'!A1:B20" }).catch(() => ({ data: { values: [] } })),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Lancamentos'!A2:E9999" }).catch(() => ({ data: { values: [] } })),
  ]);

  // ── Ciclo do cartão: lê ciclo_inicio e melhor_dia_compra do App_Config ──────
  let variaveisRealMap = null;
  let melhorDiaCompra  = null;
  let cicloInicioMs    = 0;

  for (const row of configRes.data.values ?? []) {
    const key = String(row[0] ?? "").trim().toLowerCase();
    if (key === "ciclo_inicio") {
      cicloInicioMs = parseDateBR(String(row[1] ?? ""));
    }
    if (key === "melhor_dia_compra") {
      melhorDiaCompra = parseInt(row[1] ?? "") || null;
    }
  }

  // Calcula o label do ciclo atual (ex: "maio/26") a partir de melhor_dia_compra
  const MES_PT_ABBR = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  function cicloAtualLabel(melhorDia) {
    const now    = new Date(Date.now() - 3 * 3600 * 1000); // BRT = UTC-3
    const today  = now.getUTCDate();
    const mIdx   = today < melhorDia ? now.getUTCMonth() : now.getUTCMonth() + 1;
    const mFinal = mIdx > 11 ? 0 : mIdx;
    const yFinal = mIdx > 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    return `${MES_PT_ABBR[mFinal]}/${String(yFinal).slice(2)}`;
  }

  // Monta mapa de gastos reais: filtra por Ciclo (col E) quando disponível,
  // senão usa data >= ciclo_inicio como fallback
  if (cicloInicioMs > 0 || melhorDiaCompra) {
    const cicloLabel = melhorDiaCompra ? cicloAtualLabel(melhorDiaCompra) : null;
    variaveisRealMap = {};
    for (const r of lancRes.data.values ?? []) {
      const dateMs   = parseDateBR(String(r[0] ?? ""));
      const category = String(r[2] ?? "").trim();
      const value    = Math.abs(parseNum(r[3] ?? "0"));
      const cicloRow = String(r[4] ?? "").trim().toLowerCase();
      if (!category || !value) continue;

      // Filtra por coluna Ciclo se disponível, senão por data
      if (cicloLabel && cicloRow) {
        if (cicloRow !== cicloLabel.toLowerCase()) continue;
      } else {
        if (!dateMs || dateMs < cicloInicioMs) continue;
      }
      variaveisRealMap[category] = (variaveisRealMap[category] ?? 0) + value;
    }
  }

  // ── Gastos ──────────────────────────────────────────────────────────────────
  const fixos     = { items: [], previsaoTotal: 0, realTotal: 0 };
  const variaveis = { items: [], previsaoTotal: 0, realTotal: 0 };

  // Fixos: sempre usa coluna D
  for (const row of fixosRes.data.values ?? []) {
    const grupo    = String(row[0] ?? "").trim();
    const item     = String(row[1] ?? "").trim();
    const previsao = Math.abs(parseNum(row[2] ?? "0"));
    const real     = Math.abs(parseNum(row[3] ?? "0"));
    const ctrl     = String(row[4] ?? "").toUpperCase() === "TRUE";
    const auto     = String(row[5] ?? "").toUpperCase() === "TRUE";
    if (!item) continue;
    fixos.items.push({ grupo, item, previsao, real, ctrl, auto });
    fixos.previsaoTotal += previsao;
    fixos.realTotal     += real;
  }

  // Variáveis: usa Lancamentos filtrados por ciclo (se configurado), senão coluna D
  for (const row of variaveisRes.data.values ?? []) {
    const grupo     = String(row[0] ?? "").trim();
    const item      = String(row[1] ?? "").trim();
    const previsao  = Math.abs(parseNum(row[2] ?? "0"));
    const realSheet = Math.abs(parseNum(row[3] ?? "0"));
    const real      = variaveisRealMap !== null ? (variaveisRealMap[item] ?? 0) : realSheet;
    const ctrl      = String(row[4] ?? "").toUpperCase() === "TRUE";
    if (!item) continue;
    variaveis.items.push({ grupo, item, previsao, real, ctrl });
    variaveis.previsaoTotal += previsao;
    variaveis.realTotal     += real;
  }

  // ── Ganhos ──────────────────────────────────────────────────────────────────
  const clt = [], pdv = [], emprestimos = [];
  for (const row of ganhosRes.data.values ?? []) {
    const grupo     = String(row[0] ?? "").trim().toUpperCase();
    const item      = String(row[1] ?? "").trim();
    const valor     = Math.abs(parseNum(row[2] ?? "0"));
    const confirmado = String(row[3] ?? "").toUpperCase() === "TRUE";
    if (!item || !valor) continue;
    const entry = { item, valor, confirmado };
    if (String(item).toLowerCase().includes("emprestimo")) emprestimos.push(entry);
    else if (grupo === "CLT")                               clt.push(entry);
    else                                                    pdv.push(entry);
  }
  // CLT = fixo, sempre conta. PDV e empréstimos só contam quando confirmados.
  const totalCLT = clt.reduce((s, i) => s + i.valor, 0);
  const totalPDV = pdv.reduce((s, i) => i.confirmado ? s + i.valor : s, 0);
  const totalEmp = emprestimos.reduce((s, i) => i.confirmado ? s + i.valor : s, 0);
  const ganhoTudo = totalCLT + totalPDV + totalEmp;

  // ── Poupança ─────────────────────────────────────────────────────────────────
  const historico = [];
  for (const row of poupancaRes.data.values ?? []) {
    const mes     = String(row[0] ?? "").trim();
    const valor   = parseNum(row[1] ?? "0");
    const atingido = String(row[2] ?? "").toUpperCase() === "TRUE";
    if (!mes || !valor) continue;
    historico.push({ mes, valor, atingido });
  }
  const currentMilestone = historico.find(m => !m.atingido) ?? null;
  const gastosReal = fixos.realTotal + variaveis.realTotal;
  const realidadePoupanca = ganhoTudo - gastosReal;

  // ── Compromissos (derivados de App_Parcelas) ──────────────────────────────────
  const commitItems = [];
  // Cap de pagamentos inclui o mês atual (contagem 1-indexed)
  const _capNow  = new Date();
  const _capPrevM = _capNow.getMonth() + 1; // mês atual 1-indexed (jan=1 … dez=12)
  const _capPrevY = _capNow.getFullYear();
  for (const row of parcelasRes.data.values ?? []) {
    const ativo = String(row[7] ?? "TRUE").toUpperCase();
    if (ativo === "FALSE") continue;
    const nome        = String(row[0] ?? "").trim();
    if (!nome) continue;
    const prazo         = String(row[1] ?? "").trim() || null;
    const valorMensal   = Math.abs(parseNum(row[3] ?? "0"));
    const totalParc     = parseInt(row[4] ?? "0") || 0;
    const dataInicio    = String(row[6] ?? "").trim() || null;
    const rawPagasParc  = Math.min(totalParc, Math.max(0, parseInt(row[5] ?? "0") || 0));
    // Cap inline: só conta pagamentos até o fim do mês anterior
    const _cpParts = String(dataInicio || "0/0").split("/");
    const _cpMs = parseInt(_cpParts[0]), _cpYs = parseInt(_cpParts[1]);
    const _cpMaxP = (_cpMs && _cpYs)
      ? Math.max(0, Math.min(totalParc, (_capPrevY - _cpYs) * 12 + (_capPrevM - _cpMs) + 1))
      : totalParc;
    const pagasParc = Math.min(rawPagasParc, _cpMaxP);
    // Inclui parcelas cujo prazo é o mês atual (último pagamento ainda pendente)
    if (pagasParc >= totalParc && totalParc > 0) {
      const prazoEhMesAtual = (() => {
        if (!prazo) return false;
        const now = new Date();
        const [m, y] = String(prazo).split("/").map(Number);
        return m === now.getMonth() + 1 && y === now.getFullYear();
      })();
      if (!prazoEhMesAtual) continue;
    }
    const totalRestante = valorMensal * Math.max(0, totalParc - pagasParc);
    const auto          = String(row[8] ?? "FALSE").toUpperCase() === "TRUE";
    commitItems.push({ descricao: nome, prazo, valorMensal, totalRestante, auto, totalParc, pagasParc, dataInicio });
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const gastosBudget = fixos.previsaoTotal + variaveis.previsaoTotal;

  return {
    summary: {
      ganhoCLT:     Math.abs(totalCLT),
      ganhoTudo:    Math.abs(ganhoTudo),
      gastosBudget: Math.abs(gastosBudget),
      gastosReal:   Math.abs(gastosReal),
      saldoCLT:     totalCLT  - gastosBudget,
      saldoTudo:    ganhoTudo - gastosBudget,
    },
    ganhos: {
      clt:         totalCLT,
      pdv:         totalPDV,
      emprestimos: totalEmp,
      total:       ganhoTudo,
      items:       { clt, pdv, emprestimos },
    },
    gastos: {
      budget:    Math.abs(gastosBudget),
      real:      gastosReal,
      fixos,
      variaveis,
    },
    poupanca: {
      realidade:        realidadePoupanca,
      meta:             META_POUPANCA_FINAL,
      progresso:        Math.round((realidadePoupanca / META_POUPANCA_FINAL) * 1000) / 10,
      historico,
      currentMilestone,
    },
    compromissos: {
      items:         commitItems,
      totalRestante: commitItems.reduce((s, c) => s + c.totalRestante, 0),
    },
    config: { melhorDiaCompra },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// fetchFutureCommitments — App_Parcelas
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchFutureCommitments() {
  const sheets        = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId, range: "'App_Parcelas'!A2:I300",
  });

  const items = [];
  for (const row of res.data.values ?? []) {
    const ativo = String(row[7] ?? "TRUE").toUpperCase();
    if (ativo === "FALSE") continue;
    const nome = String(row[0] ?? "").trim();
    if (!nome) continue;
    const prazo         = String(row[1] ?? "").trim() || null;
    const valorMensal   = Math.abs(parseNum(row[3] ?? "0"));
    const totalParc     = parseInt(row[4] ?? "0") || 0;
    const pagasParc     = Math.min(totalParc, Math.max(0, parseInt(row[5] ?? "0") || 0));
    if (pagasParc >= totalParc && totalParc > 0) continue;
    const totalRestante = valorMensal * Math.max(0, totalParc - pagasParc);
    items.push({ descricao: nome, prazo, valorMensal, totalRestante });
  }
  return { items, totalRestante: items.reduce((s, i) => s + i.totalRestante, 0) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// fetchDailyHistory — App_Lancamentos
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchDailyHistory() {
  const sheets        = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId, range: "'App_Lancamentos'!A2:E9999",
  });

  const byDate = {};
  for (const row of res.data.values ?? []) {
    const dateRaw  = String(row[0] ?? "").trim();
    const category = String(row[2] ?? "").trim();
    const value    = Math.abs(parseNum(row[3] ?? "0"));
    if (!dateRaw || !category || !value) continue;
    if (!byDate[dateRaw]) byDate[dateRaw] = {};
    byDate[dateRaw][category] = (byDate[dateRaw][category] || 0) + value;
  }

  const parseDate = s => {
    const [d, m, y] = s.split("/").map(Number);
    return isNaN(d) ? 0 : new Date(y, m - 1, d).getTime();
  };

  return Object.entries(byDate)
    .map(([date, cats]) => ({
      date,
      entries: Object.entries(cats).map(([category, value]) => ({ category, value })),
    }))
    .sort((a, b) => parseDate(b.date) - parseDate(a.date));
}
