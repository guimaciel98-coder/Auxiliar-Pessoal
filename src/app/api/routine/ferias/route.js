import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

function feriasSheetId() {
  return process.env.GOOGLE_FERIAS_SPREADSHEET_ID || getSpreadsheetId();
}

async function ensureSheet(sheets, id) {
  try {
    await sheets.spreadsheets.values.get({ spreadsheetId: id, range: "'App_Ferias'!A1" });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: [{ addSheet: { properties: { title: "App_Ferias" } } }] },
    });
  }
}

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    const id = feriasSheetId();
    await ensureSheet(sheets, id);
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: "'App_Ferias'!A1" });
    const raw = res.data.values?.[0]?.[0];
    if (!raw) return Response.json({ ok: true, data: null });
    return Response.json({ ok: true, data: JSON.parse(raw) });
  } catch (e) {
    console.error("[GET /api/routine/ferias]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const sheets = await getSheetsClient();
    const id = feriasSheetId();
    await ensureSheet(sheets, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: "'App_Ferias'!A1",
      valueInputOption: "RAW",
      requestBody: { values: [[JSON.stringify(body)]] },
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/routine/ferias]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
