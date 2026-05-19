import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

const SOURCE = "Financeiro - Gastos Variaveis Dia";
const TARGET = "App_Lancamentos";

function parseNum(raw) {
  return parseFloat(
    String(raw ?? "0").trim().replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")
  ) || 0;
}
function toSheetNum(n) { return Number(n).toFixed(2).replace(".", ","); }

/**
 * GET  → preview: lê as primeiras 5 linhas da fonte para inspecionar estrutura
 * POST → executa a importação: limpa App_Lancamentos e reimporta
 *        Query: ?col_data=A&col_desc=B&col_cat=C&col_valor=D&start_row=2
 */

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    if (searchParams.get("target") === "1") {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId, range: `'${TARGET}'!A1:E9999`,
      });
      const rows = res.data.values ?? [];
      const data = rows.slice(1).filter(r => r[0]);
      // Agrupa por ciclo
      const byCiclo = {};
      for (const r of data) {
        const ciclo = String(r[4] ?? "—").trim();
        if (!byCiclo[ciclo]) byCiclo[ciclo] = { count: 0, cats: {} };
        byCiclo[ciclo].count++;
        const cat = String(r[2] ?? "").trim();
        const val = parseNum(r[3] ?? "0");
        if (cat) byCiclo[ciclo].cats[cat] = (byCiclo[ciclo].cats[cat] ?? 0) + val;
      }
      return Response.json({ ok: true, header: rows[0] ?? [], total: data.length, byCiclo });
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `'${SOURCE}'!A1:Z10`,
    });
    const rows = res.data.values ?? [];
    return Response.json({ ok: true, header: rows[0] ?? [], sample: rows.slice(1, 6) });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // 1. Lê TODA a fonte (formato largo: linha 1 = datas, colunas B = categorias)
    const sourceRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SOURCE}'!A1:ZZ9999`,
    });
    const allRows = sourceRes.data.values ?? [];
    if (allRows.length < 2) {
      return Response.json({ ok: false, error: "Aba fonte vazia ou sem dados" }, { status: 400 });
    }

    const DATE_RE  = /^\d{2}\/\d{2}\/\d{4}$/;
    const CYCLE_RE = /^[a-záàâãéèêíìîóòôõúùûç]+\/\d{2}$/i; // "maio/26", "abril/26"
    const DATE_START = 3; // datas começam na coluna índice 3 (D)

    // Uma linha é cabeçalho de ciclo se: col B = label de ciclo, col C = "TOTAL", cols D+ = datas
    function isCycleHeader(r) {
      return CYCLE_RE.test(String(r[1] ?? "").trim()) &&
             String(r[2] ?? "").trim().toUpperCase() === "TOTAL" &&
             r.slice(DATE_START).some(v => DATE_RE.test(String(v ?? "").trim()));
    }

    // Percorre TODOS os blocos de ciclo na fonte
    const newRows = [];
    let currentCiclo = null;
    let currentDates = [];

    for (let ri = 0; ri < allRows.length; ri++) {
      const row = allRows[ri];

      if (isCycleHeader(row)) {
        // Novo bloco de ciclo
        currentCiclo = String(row[1] ?? "").trim();
        currentDates = row.slice(DATE_START).map(v => String(v ?? "").trim());
        continue;
      }

      if (!currentCiclo) continue; // ainda não encontrou o primeiro cabeçalho

      const categoria = String(row[1] ?? "").trim();
      if (!categoria || categoria.toUpperCase() === "TOTAL") continue;

      for (let di = 0; di < currentDates.length; di++) {
        const data = currentDates[di];
        if (!DATE_RE.test(data)) continue;
        const rawVal = String(row[DATE_START + di] ?? "").trim();
        if (!rawVal) continue;
        const valor = Math.abs(parseNum(rawVal));
        if (valor <= 0) continue;
        newRows.push([data, "", categoria, toSheetNum(valor), currentCiclo]);
      }
    }

    if (newRows.length === 0) {
      return Response.json({ ok: false, error: "Nenhum lançamento válido encontrado na fonte" }, { status: 400 });
    }

    // 2. Ordena por data (DD/MM/AAAA → comparável)
    newRows.sort((a, b) => {
      const [da, ma, ya] = a[0].split("/").map(Number);
      const [db, mb, yb] = b[0].split("/").map(Number);
      return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
    });

    // 3. Garante que App_Lancamentos existe
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const exists = meta.data.sheets.some(s => s.properties.title === TARGET);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: TARGET } } }] },
      });
    }

    // 4. Limpa dados existentes (mantém cabeçalho)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${TARGET}'!A2:E9999`,
    });

    // 5. Escreve cabeçalho + novos dados
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${TARGET}'!A1:E1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["Data", "Descrição", "Categoria", "Valor", "Ciclo"]] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${TARGET}'!A2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: newRows },
    });

    return Response.json({ ok: true, importados: newRows.length });
  } catch (e) {
    console.error("[POST /api/finance/import-lancamentos]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
