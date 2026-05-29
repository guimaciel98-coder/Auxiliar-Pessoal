import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

// POST — adiciona nova linha em App_Ganhos
// Body: { grupo: "CLT"|"PDV"|"Outros", item: string, valor: number, confirmado?: boolean }
export async function POST(req) {
  try {
    const { grupo, item, valor, confirmado = false } = await req.json();

    if (!grupo?.trim() || !item?.trim() || !valor || Number(valor) <= 0) {
      return Response.json({ ok: false, error: "grupo, item e valor são obrigatórios" }, { status: 400 });
    }

    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range:            "'App_Ganhos'!A:D",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          grupo.trim().toUpperCase(),
          item.trim(),
          Number(valor),
          confirmado ? "TRUE" : "FALSE",
        ]],
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/finance/ganho/add]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
