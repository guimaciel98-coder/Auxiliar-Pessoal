import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { item, confirmado } = await req.json();
    if (!item || confirmado === undefined) {
      return Response.json({ ok: false, error: "item e confirmado são obrigatórios" }, { status: 400 });
    }

    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const res    = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Ganhos'!A2:D500" });
    const rows   = res.data.values ?? [];
    const rowIdx = rows.findIndex(r => String(r[1] ?? "").trim() === String(item).trim());

    if (rowIdx === -1) {
      return Response.json({ ok: false, error: `Item "${item}" não encontrado` }, { status: 404 });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range:            `'App_Ganhos'!D${rowIdx + 2}`,
      valueInputOption: "RAW",
      requestBody:      { values: [[confirmado ? "TRUE" : "FALSE"]] },
    });

    return Response.json({ ok: true, item, confirmado });
  } catch (e) {
    console.error("[toggle ganho]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
