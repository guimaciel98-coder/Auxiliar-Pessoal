import { getSheetsClient } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

const ID    = process.env.GOOGLE_ROUTINE_SPREADSHEET_ID ?? "13y2HHURgSwQp9k29w8IF6V8_QEZNskMF7j0ENOM8Gpk";
const SHEET = "App_Eventos";

// POST — adiciona evento
export async function POST(req) {
  try {
    const { data, evento, tipo } = await req.json();
    if (!data || !evento?.trim()) {
      return Response.json({ ok: false, error: "data e evento são obrigatórios" }, { status: 400 });
    }
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId:    ID,
      range:            `'${SHEET}'!A:C`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody:      { values: [[data, evento.trim(), tipo ?? ""]] },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// DELETE — remove evento por linha
export async function DELETE(req) {
  try {
    const { sheetRow } = await req.json();
    if (!sheetRow) return Response.json({ ok: false, error: "sheetRow obrigatório" }, { status: 400 });
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.clear({ spreadsheetId: ID, range: `'${SHEET}'!A${sheetRow}:C${sheetRow}` });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
