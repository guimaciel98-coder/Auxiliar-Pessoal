import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

const SHEET = "App_Parcelas";

export async function POST(req) {
  try {
    const { sheetRow } = await req.json();
    if (!sheetRow) return Response.json({ error: "sheetRow é obrigatório" }, { status: 400 });

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${SHEET}'!H${sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["FALSE"]] },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/finance/installments/remove]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
