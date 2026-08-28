import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

export async function DELETE(req) {
  try {
    const { item } = await req.json();
    if (!item?.trim()) return Response.json({ ok: false, error: "item obrigatório" }, { status: 400 });

    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // Encontra a linha pelo nome do item (col B)
    const res  = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'App_Gastos_Fixos'!A2:F500",
    });
    const rows = res.data.values ?? [];
    const idx  = rows.findIndex(r => String(r[1] ?? "").trim() === String(item).trim());
    if (idx === -1) return Response.json({ ok: false, error: "Item não encontrado" }, { status: 404 });

    // Busca o sheetId numérico da aba
    const meta    = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = meta.data.sheets.find(s => s.properties.title === "App_Gastos_Fixos")?.properties?.sheetId ?? 0;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: idx + 1, endIndex: idx + 2 },
          },
        }],
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/finance/fixo/delete]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
