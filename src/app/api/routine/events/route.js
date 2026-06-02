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

// DELETE — remove a linha inteira (deleteDimension, não clear)
export async function DELETE(req) {
  try {
    const { sheetRow } = await req.json();
    if (!sheetRow) return Response.json({ ok: false, error: "sheetRow obrigatório" }, { status: 400 });

    const sheets = await getSheetsClient();

    // Busca o sheetId da aba App_Eventos
    const meta    = await sheets.spreadsheets.get({ spreadsheetId: ID });
    const sheet   = meta.data.sheets.find(s => s.properties.title === SHEET);
    if (!sheet) return Response.json({ ok: false, error: "Aba não encontrada" }, { status: 404 });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId:    sheet.properties.sheetId,
              dimension:  "ROWS",
              startIndex: sheetRow - 1, // 0-indexed
              endIndex:   sheetRow,
            },
          },
        }],
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
