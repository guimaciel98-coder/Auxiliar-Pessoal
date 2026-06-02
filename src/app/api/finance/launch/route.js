import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

const LOG = "App_Lancamentos";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseNum(raw) {
  return (
    parseFloat(
      String(raw ?? "0")
        .trim()
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    ) || 0
  );
}

function toSheetNum(n) {
  return Number(n).toFixed(2).replace(".", ",");
}

/** "2026-05-13" → "13/05/2026" */
function isoToSheet(iso) {
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

async function ensureLog(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets.some(s => s.properties.title === LOG);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: LOG } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${LOG}'!A1:D1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["Data", "Descrição", "Categoria", "Valor"]] },
    });
  }
}

// ── GET — últimos 15 lançamentos ─────────────────────────────────────────────

export async function GET() {
  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    await ensureLog(sheets, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${LOG}'!A2:E9999`,
    });

    const raw = res.data.values ?? [];
    const entries = raw
      .map(([data, descricao, categoria, valor, ciclo], idx) => ({
        rowIndex:  idx + 2, // sheet row (1-indexed + header)
        data:      (data ?? "").trim(),
        descricao: descricao ?? "",
        categoria: categoria ?? "",
        valor:     parseNum(valor),
        ciclo:     (ciclo ?? "").trim(),
      }))
      .filter(e => e.data)
      .reverse();

    return Response.json({ ok: true, entries });
  } catch (e) {
    console.error("[GET /api/finance/launch]", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ── POST — registrar lançamento ──────────────────────────────────────────────

export async function POST(req) {
  try {
    const { date, descricao, category, value, ciclo } = await req.json();

    if (!category?.trim())
      return Response.json({ ok: false, error: "Categoria é obrigatória" }, { status: 400 });
    if (!value || Number(value) <= 0)
      return Response.json({ ok: false, error: "Valor deve ser positivo" }, { status: 400 });
    if (!date)
      return Response.json({ ok: false, error: "Data é obrigatória" }, { status: 400 });

    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    await ensureLog(sheets, spreadsheetId);

    const sheetDate = isoToSheet(date);
    const numValue  = Number(value);

    // Escreve apenas em Lançamentos — "Gastos Variaveis Dia" lê via SUMIFS
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${LOG}'!A:D`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[sheetDate, (descricao ?? "").trim(), category.trim(), toSheetNum(numValue), (ciclo ?? "").trim()]],
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/finance/launch]", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ── DELETE — remove linha pelo rowIndex ───────────────────────────────────────
export async function DELETE(req) {
  try {
    const { rowIndex } = await req.json();
    if (!rowIndex || rowIndex < 2) {
      return Response.json({ ok: false, error: "rowIndex inválido" }, { status: 400 });
    }

    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // Pega o sheetId da aba App_Lancamentos
    const meta   = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet  = meta.data.sheets.find(s => s.properties.title === LOG);
    if (!sheet) return Response.json({ ok: false, error: "Aba não encontrada" }, { status: 404 });

    const sheetId = sheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension:  "ROWS",
              startIndex: rowIndex - 1, // 0-indexed
              endIndex:   rowIndex,
            },
          },
        }],
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/finance/launch]", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
