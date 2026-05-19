/**
 * POST /api/routine/setup
 * Lê "Foco Ano"!N:O da planilha de rotina,
 * cria a aba App_Eventos e migra todos os eventos.
 */
import { getSheetsClient } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

const SPREADSHEET_ID = process.env.GOOGLE_ROUTINE_SPREADSHEET_ID ?? "13y2HHURgSwQp9k29w8IF6V8_QEZNskMF7j0ENOM8Gpk";
const SOURCE_SHEET   = "Foco Ano";
const TARGET_SHEET   = "App_Eventos";

function inferYear(dd, mm, prevMm, baseYear) {
  // Se o mês voltou (ex: Dez→Jan), avança o ano
  if (prevMm !== null && mm < prevMm && prevMm >= 10) return baseYear + 1;
  return baseYear;
}

export async function POST() {
  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = SPREADSHEET_ID;

    // 1. Lê N:O da aba Foco Ano
    const res  = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SOURCE_SHEET}'!N:O`,
    });
    const rows = res.data.values ?? [];

    // 2. Parseia eventos
    const BASE_YEAR = 2026;
    let   curYear   = BASE_YEAR;
    let   prevMm    = null;
    const events    = [];

    for (const row of rows) {
      const rawDate  = String(row[0] ?? "").trim();
      const activity = String(row[1] ?? "").trim();
      if (!rawDate || !activity) continue;

      // Aceita DD/MM ou DD/MM/YYYY
      const m = rawDate.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
      if (!m) continue;

      const dd = parseInt(m[1]);
      const mm = parseInt(m[2]);
      const yy = m[3] ? parseInt(m[3]) : null;

      if (dd < 1 || dd > 31 || mm < 1 || mm > 12) continue;

      if (yy) {
        curYear = yy;
      } else {
        curYear = inferYear(dd, mm, prevMm, curYear);
      }
      prevMm = mm;

      const dateStr = `${String(dd).padStart(2,"0")}/${String(mm).padStart(2,"0")}/${curYear}`;
      events.push([dateStr, activity, ""]);
    }

    if (events.length === 0) {
      return Response.json({ ok: false, error: "Nenhum evento encontrado na aba 'Foco Ano'" });
    }

    // 3. Cria App_Eventos se não existir
    const meta     = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = meta.data.sheets?.find(s => s.properties.title === TARGET_SHEET);
    if (!existing) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: TARGET_SHEET } } }] },
      });
    }

    // 4. Limpa e escreve tudo
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${TARGET_SHEET}'!A:C` });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range:            `'${TARGET_SHEET}'!A1:C1`,
      valueInputOption: "RAW",
      requestBody:      { values: [["Data", "Evento", "Tipo"]] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range:            `'${TARGET_SHEET}'!A2:C${events.length + 1}`,
      valueInputOption: "RAW",
      requestBody:      { values: events },
    });

    return Response.json({ ok: true, migrated: events.length, preview: events.slice(0, 5) });
  } catch (e) {
    console.error("[POST /api/routine/setup]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
