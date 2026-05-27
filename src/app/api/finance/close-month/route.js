/**
 * /api/finance/close-month
 *
 * GET  → preview do que será feito no tombamento
 * POST → executa o tombamento do mês
 *
 * Tombamento inclui:
 *  1. App_Gastos_Fixos  — reseta Controle (col E) de todos para FALSE
 *  2. App_Ganhos        — reseta Confirmado (col D) de todos para FALSE
 *  3. App_Poupanca      — adiciona linha do próximo mês (Atingido=FALSE)
 *                         se ainda não existir
 */

import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

const FIXOS      = "App_Gastos_Fixos";
const GANHOS     = "App_Ganhos";
const POUPANCA   = "App_Poupanca";
const VARIAVEIS  = "App_Gastos_Variaveis";
const CONFIG     = "App_Config";

const MES_PT = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro",
];

function parseNum(raw) {
  return parseFloat(String(raw??"0").trim().replace(/[R$\s]/g,"").replace(/\./g,"").replace(",",".")) || 0;
}
function toSheetNum(n) { return Number(n).toFixed(2).replace(".",","); }

function proximoMesLabel() {
  const d   = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${MES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}
function mesAtualLabel() {
  const d = new Date();
  return `${MES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

// ── Leitura helpers ───────────────────────────────────────────────────────────

async function readSheet(sheets, spreadsheetId, range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values ?? [];
}

// ── Preview ───────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const [fixosRows, ganhosRows, poupancaRows, configRows] = await Promise.all([
      readSheet(sheets, spreadsheetId, `'${FIXOS}'!A2:E500`),
      readSheet(sheets, spreadsheetId, `'${GANHOS}'!A2:D500`),
      readSheet(sheets, spreadsheetId, `'${POUPANCA}'!A2:C100`),
      sheets.spreadsheets.values.get({ spreadsheetId, range: `'${CONFIG}'!A1:B20` })
        .then(r => r.data.values ?? []).catch(() => []),
    ]);

    const fixosPagos      = fixosRows.filter(r => String(r[4]??"").toUpperCase()==="TRUE").length;
    const fixosTotal      = fixosRows.filter(r => r[1]?.trim()).length;
    const ganhosPendentes = ganhosRows.filter(r => String(r[3]??"").toUpperCase()!=="TRUE").length;
    const ganhosTotal     = ganhosRows.filter(r => r[1]?.trim()).length;

    const proxMes        = proximoMesLabel();
    const cicloInicio    = (configRows.find(r => String(r[0]??"").toLowerCase().trim() === "ciclo_inicio") ?? [])[1] ?? null;
    const atingidos      = poupancaRows.filter(r => String(r[2]??"").toUpperCase() === "TRUE");
    const poupancaAcumulada = atingidos.length > 0 ? parseNum(atingidos[atingidos.length - 1][1]) : 0;

    const melhorDiaAtual = (() => {
      for (const r of configRows) {
        if (String(r[0] ?? "").trim().toLowerCase() === "melhor_dia_compra") return parseInt(r[1] ?? "") || null;
      }
      return null;
    })();

    return Response.json({
      ok: true,
      mesAtual:      mesAtualLabel(),
      proximoMes:    proxMes,
      cicloInicio,
      melhorDiaAtual,
      poupancaAcumulada,
      preview: {
        fixos: {
          pagos: fixosPagos,
          total: fixosTotal,
          acao:  `${fixosTotal} gastos fixos terão status de pago resetado para o novo mês`,
        },
        ganhos: {
          pendentes: ganhosPendentes,
          total:     ganhosTotal,
          acao:      `${ganhosTotal} fontes de ganho terão confirmação resetada para o novo mês`,
        },
      },
    });
  } catch (e) {
    console.error("[GET /api/finance/close-month]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ── Tombamento ────────────────────────────────────────────────────────────────

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  let { cycleStartDate, poupancaTotal, poupancaFatura, melhorDia } = body;

  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const PARCELAS = "App_Parcelas";
    const [fixosRows, ganhosRows, poupancaRows, variaveisRows, parcelasRows, configRows] = await Promise.all([
      readSheet(sheets, spreadsheetId, `'${FIXOS}'!A2:F500`), // F = Auto
      readSheet(sheets, spreadsheetId, `'${GANHOS}'!A2:D500`),
      readSheet(sheets, spreadsheetId, `'${POUPANCA}'!A2:C100`),
      readSheet(sheets, spreadsheetId, `'${VARIAVEIS}'!A2:D100`),
      readSheet(sheets, spreadsheetId, `'${PARCELAS}'!A2:J300`).catch(() => []),
      sheets.spreadsheets.values.get({ spreadsheetId, range: `'${CONFIG}'!A1:B20` })
        .then(r => r.data.values ?? []).catch(() => []),
    ]);

    // Auto-computa cycleStartDate a partir de melhor_dia_compra se não informado
    if (!cycleStartDate) {
      const melhorDia = (() => {
        for (const row of configRows) {
          if (String(row[0] ?? "").trim().toLowerCase() === "melhor_dia_compra") {
            return parseInt(row[1] ?? "") || null;
          }
        }
        return null;
      })();
      if (melhorDia) {
        const now   = new Date();
        const dd    = String(melhorDia).padStart(2, "0");
        const mm    = String(now.getMonth() + 1).padStart(2, "0");
        cycleStartDate = `${dd}/${mm}/${now.getFullYear()}`;
      }
    }

    const updates = [];
    let   resultado = {};

    // ── 1. Gastos Fixos: auto → mantém TRUE; manuais → reset para FALSE ─────────
    // Col F = Auto (pagamento automático → não precisa ser marcado manualmente)
    let fixosResetados = 0, fixosAutoMantidos = 0;
    fixosRows.forEach((row, i) => {
      if (!row[1]?.trim()) return;
      const isAuto = String(row[5] ?? "FALSE").toUpperCase() === "TRUE";
      updates.push({ range: `'${FIXOS}'!E${i + 2}`, values: [[isAuto ? "TRUE" : "FALSE"]] });
      if (isAuto) fixosAutoMantidos++; else fixosResetados++;
    });
    resultado.fixosResetados    = fixosResetados;
    resultado.fixosAutoMantidos = fixosAutoMantidos;

    // ── 2. Ganhos: reset Confirmado → FALSE ───────────────────────────────────
    let ganhosResetados = 0;
    ganhosRows.forEach((row, i) => {
      if (!row[1]?.trim()) return;
      updates.push({
        range:  `'${GANHOS}'!D${i + 2}`,
        values: [["FALSE"]],
      });
      ganhosResetados++;
    });
    resultado.ganhosResetados = ganhosResetados;

    // ── 3. Parcelas: auto → avança F+1; todas → reseta Pago(J)=FALSE ────────────
    // App_Parcelas: A:Nome B:DataFim C:ValorTotal D:ValorMensal E:TotalParc F:ParcelasPagas G:DataInicio H:Ativo I:Auto J:Pago
    let parcelasAvancadas = 0, parcelasConcluidas = 0;
    parcelasRows.forEach((row, i) => {
      const nome   = String(row[0] ?? "").trim();
      const ativo  = String(row[7] ?? "TRUE").toUpperCase();
      const isAuto = String(row[8] ?? "FALSE").toUpperCase() === "TRUE";
      if (!nome || ativo === "FALSE") return;

      // Auto → J=TRUE (já pago automaticamente); manual → J=FALSE (aguarda ação)
      updates.push({ range: `'${PARCELAS}'!J${i + 2}`, values: [[isAuto ? "TRUE" : "FALSE"]] });

      // Incrementa F apenas para parcelas automáticas
      if (isAuto) {
        const totalParc = parseInt(row[4] ?? "0") || 0;
        const pagas     = parseInt(row[5] ?? "0") || 0;
        const newPagas  = pagas + 1;
        updates.push({ range: `'${PARCELAS}'!F${i + 2}`, values: [[String(newPagas)]] });
        parcelasAvancadas++;
        if (totalParc > 0 && newPagas >= totalParc) {
          updates.push({ range: `'${PARCELAS}'!H${i + 2}`, values: [["FALSE"]] });
          parcelasConcluidas++;
        }
      }
    });
    resultado.parcelasAvancadas  = parcelasAvancadas;
    resultado.parcelasConcluidas = parcelasConcluidas;

    // ── 4. Poupança: total acumulado − fatura do cartão → Atingido = TRUE ────
    const mesAtual = mesAtualLabel();
    if (poupancaTotal !== undefined && poupancaTotal !== null && !isNaN(Number(poupancaTotal))) {
      const novoAcumulado = Number(poupancaTotal) - (Number(poupancaFatura) || 0);

      // Encontra a linha do mês atual (já existe nas projeções)
      const mesIdx = poupancaRows.findIndex(r =>
        String(r[0] ?? "").toLowerCase().trim() === mesAtual.toLowerCase()
      );

      if (mesIdx >= 0) {
        updates.push({ range: `'${POUPANCA}'!B${mesIdx + 2}`, values: [[toSheetNum(novoAcumulado)]] });
        updates.push({ range: `'${POUPANCA}'!C${mesIdx + 2}`, values: [["TRUE"]] });
      } else {
        updates.push({
          range:  `'${POUPANCA}'!A${poupancaRows.length + 2}`,
          values: [[mesAtual, toSheetNum(novoAcumulado), "TRUE"]],
        });
      }
      resultado.poupancaAtualizada = { mes: mesAtual, acumulado: novoAcumulado };
    }

    // ── Ciclo do cartão: salva nova data de início e reseta variaveis real ───────
    if (cycleStartDate) {
      // Reseta App_Gastos_Variaveis!D para 0 (novo ciclo começa zerado)
      variaveisRows.forEach((row, i) => {
        if (!row[1]?.trim()) return;
        updates.push({ range: `'${VARIAVEIS}'!D${i + 2}`, values: [["0"]] });
      });
      resultado.variaveisResetadas = variaveisRows.filter(r => r[1]?.trim()).length;
    }

    // ── Escreve tudo em batch ─────────────────────────────────────────────────
    if (updates.length > 0) {
      const BATCH = 500;
      for (let i = 0; i < updates.length; i += BATCH) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: "USER_ENTERED",
            data: updates.slice(i, i + BATCH),
          },
        });
      }
    }

    // ── Salva histórico do fechamento em App_Historico_Meses ─────────────────────
    const HIST = "App_Historico_Meses";
    const totalGanhos        = ganhosRows.reduce((s, r) => r[1]?.trim() ? s + parseNum(r[2]) : s, 0);
    const totalFixosReal     = fixosRows.reduce((s, r) => r[1]?.trim() ? s + parseNum(r[3]) : s, 0);
    const totalVariaveisReal = variaveisRows.reduce((s, r) => r[1]?.trim() ? s + parseNum(r[3]) : s, 0);
    const totalParcelasReal  = parcelasRows.reduce((s, row) => {
      if (String(row[7] ?? "TRUE").toUpperCase() === "FALSE") return s;
      if (!String(row[0] ?? "").trim()) return s;
      return s + Math.abs(parseNum(row[3] ?? "0")); // D: ValorMensal
    }, 0);
    const poupLiquida        = poupancaTotal !== undefined ? (Number(poupancaTotal) - (Number(poupancaFatura) || 0)) : 0;
    const saldoMes           = totalGanhos - totalFixosReal - totalVariaveisReal - totalParcelasReal;
    const dataHoje           = new Date().toLocaleDateString("pt-BR");
    const histRow            = [[mesAtual, dataHoje, toSheetNum(totalGanhos), toSheetNum(totalFixosReal), toSheetNum(totalVariaveisReal), toSheetNum(poupLiquida), toSheetNum(saldoMes), toSheetNum(totalParcelasReal)]];

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${HIST}'!A:G`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: histRow },
      });
    } catch {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: HIST } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `'${HIST}'!A1:G1`, valueInputOption: "RAW",
        requestBody: { values: [["Ciclo","DataFechamento","Ganhos","GastosFixos","GastosVariaveis","Poupanca","Saldo"]] },
      });
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${HIST}'!A:G`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: histRow },
      });
    }
    resultado.historicoSalvo = { ciclo: mesAtual, ganhos: totalGanhos, fixos: totalFixosReal, variaveis: totalVariaveisReal, poupanca: poupLiquida, saldo: saldoMes };

    // ── Salva ciclo_inicio e melhor_dia_compra no App_Config ─────────────────────
    if (cycleStartDate || melhorDia) {
      try {
        await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${CONFIG}'!A1` });
      } catch {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: CONFIG } } }] },
        });
      }
      // Lê estado atual para não sobrescrever valor que não foi alterado
      const cfgCurrent = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${CONFIG}'!A1:B20` })
        .then(r => r.data.values ?? []).catch(() => []);
      const cfgMap = {};
      cfgCurrent.forEach(r => { if (r[0]) cfgMap[String(r[0]).trim().toLowerCase()] = r[1] ?? ""; });

      if (cycleStartDate) cfgMap["ciclo_inicio"]      = cycleStartDate;
      if (melhorDia)      cfgMap["melhor_dia_compra"] = String(parseInt(melhorDia));

      // Reconstrói array de linhas preservando outras chaves
      const cfgRows = Object.entries(cfgMap).map(([k, v]) => [k, v]);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${CONFIG}'!A1:B${cfgRows.length}`,
        valueInputOption: "RAW",
        requestBody: { values: cfgRows },
      });

      if (cycleStartDate) resultado.novoCicloInicio = cycleStartDate;
      if (melhorDia)      resultado.novoMelhorDia   = parseInt(melhorDia);
    }

    return Response.json({ ok: true, resultado });
  } catch (e) {
    console.error("[POST /api/finance/close-month]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
