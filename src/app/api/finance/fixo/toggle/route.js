import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    // field: "ctrl" (col E, padrão) | "auto" (col F)
    const { item, ctrl, field = "ctrl" } = await req.json();
    if (!item || ctrl === undefined) {
      return Response.json({ ok: false, error: "item e ctrl são obrigatórios" }, { status: 400 });
    }

    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const res  = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'App_Gastos_Fixos'!A2:F500",
    });

    const rows   = res.data.values ?? [];
    const rowIdx = rows.findIndex(r => String(r[1] ?? "").trim() === String(item).trim());

    if (rowIdx === -1) {
      return Response.json({ ok: false, error: `Item "${item}" não encontrado` }, { status: 404 });
    }

    const col = field === "auto" ? "F" : "E";
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range:            `'App_Gastos_Fixos'!${col}${rowIdx + 2}`,
      valueInputOption: "RAW",
      requestBody:      { values: [[ctrl ? "TRUE" : "FALSE"]] },
    });

    return Response.json({ ok: true, item, ctrl, field });
  } catch (e) {
    console.error("[toggle fixo]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
