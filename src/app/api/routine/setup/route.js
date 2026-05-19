/**
 * GET  /api/routine/setup  → lista abas da planilha (debug)
 * POST /api/routine/setup  → migra Foco Ano N:O → App_Eventos
 */
import { getSheetsClient } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

const SPREADSHEET_ID = process.env.GOOGLE_ROUTINE_SPREADSHEET_ID ?? "13y2HHURgSwQp9k29w8IF6V8_QEZNskMF7j0ENOM8Gpk";
const TARGET_SHEET   = "App_Eventos";

function inferYear(dd, mm, prevMm, baseYear) {
  if (prevMm !== null && mm < prevMm && prevMm >= 10) return baseYear + 1;
  return baseYear;
}

// GET — lista abas e primeiras linhas de N:O
export async function GET() {
  try {
    const sheets = await getSheetsClient();
    const meta   = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetNames = meta.data.sheets?.map(s => s.properties.title) ?? [];

    // Tenta ler N:O de cada aba para achar onde estão os eventos
    const samples = {};
    for (const name of sheetNames) {
      try {
        const r = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${name}'!N1:O5`,
        });
        samples[name] = r.data.values ?? [];
      } catch { samples[name] = []; }
    }

    return Response.json({ ok: true, sheets: sheetNames, samples });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body       = await req.json().catch(() => ({}));
    const sourceSheet = body.sheet ?? "Foco Ano";
    const colRange    = body.range ?? `'${sourceSheet}'!N:O`;

    const sheets        = await getSheetsClient();
    const spreadsheetId = SPREADSHEET_ID;

    const res  = await sheets.spreadsheets.values.get({ spreadsheetId, range: colRange });
    const rows = res.data.values ?? [];

    const BASE_YEAR = 2026;
    let   curYear   = BASE_YEAR;
    let   prevMm    = null;
    const events    = [];

    for (const row of rows) {
      const rawDate  = String(row[0] ?? "").trim();
      const activity = String(row[1] ?? "").trim();
      if (!rawDate || !activity) continue;

      const m = rawDate.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
      if (!m) continue;

      const dd = parseInt(m[1]);
      const mm = parseInt(m[2]);
      const yy = m[3] ? parseInt(m[3]) : null;
      if (dd < 1 || dd > 31 || mm < 1 || mm > 12) continue;

      curYear = yy ?? inferYear(dd, mm, prevMm, curYear);
      prevMm  = mm;

      events.push([
        `${String(dd).padStart(2,"0")}/${String(mm).padStart(2,"0")}/${curYear}`,
        activity,
        "",
      ]);
    }

    if (events.length === 0) {
      return Response.json({ ok: false, error: `Nenhum evento em ${colRange}` });
    }

    // Cria App_Eventos se necessário
    const meta     = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = meta.data.sheets?.find(s => s.properties.title === TARGET_SHEET);
    if (!existing) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: TARGET_SHEET } } }] },
      });
    }

    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${TARGET_SHEET}'!A:C` });
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `'${TARGET_SHEET}'!A1:C1`,
      valueInputOption: "RAW",
      requestBody: { values: [["Data","Evento","Tipo"]] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `'${TARGET_SHEET}'!A2:C${events.length + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: events },
    });

    return Response.json({ ok: true, migrated: events.length, preview: events.slice(0, 5) });
  } catch (e) {
    console.error("[POST /api/routine/setup]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
