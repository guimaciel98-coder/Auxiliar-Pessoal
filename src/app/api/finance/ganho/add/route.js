import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

// PATCH — edita ganho existente em App_Ganhos
// Body: { itemAtual: string, grupo?: string, item?: string, valor?: number, confirmado?: boolean, prazo?: string }
export async function PATCH(req) {
  try {
    const { itemAtual, grupo, item, valor, confirmado, prazo } = await req.json();
    if (!itemAtual?.trim()) {
      return Response.json({ ok: false, error: "itemAtual é obrigatório" }, { status: 400 });
    }

    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const res  = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Ganhos'!A2:E500" });
    const rows = res.data.values ?? [];
    const idx  = rows.findIndex(r => String(r[1] ?? "").trim() === itemAtual.trim());
    if (idx === -1) return Response.json({ ok: false, error: `"${itemAtual}" não encontrado` }, { status: 404 });

    const row     = idx + 2;
    const updates = [];
    if (grupo     !== undefined) updates.push({ range: `'App_Ganhos'!A${row}`, values: [[String(grupo).toUpperCase()]] });
    if (item      !== undefined) updates.push({ range: `'App_Ganhos'!B${row}`, values: [[String(item).trim()]] });
    if (valor     !== undefined) updates.push({ range: `'App_Ganhos'!C${row}`, values: [[Number(valor)]] });
    if (confirmado !== undefined) updates.push({ range: `'App_Ganhos'!D${row}`, values: [[confirmado ? "TRUE" : "FALSE"]] });
    if (prazo     !== undefined) updates.push({ range: `'App_Ganhos'!E${row}`, values: [[String(prazo ?? "").trim()]] });

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data: updates },
      });
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/finance/ganho/add]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST — adiciona nova linha em App_Ganhos
// Body: { grupo: "CLT"|"PDV"|"EMPRESTIMOS", item: string, valor: number, confirmado?: boolean, prazo?: string }
export async function POST(req) {
  try {
    const { grupo, item, valor, confirmado = false, prazo = "" } = await req.json();

    if (!grupo?.trim() || !item?.trim() || !valor || Number(valor) <= 0) {
      return Response.json({ ok: false, error: "grupo, item e valor são obrigatórios" }, { status: 400 });
    }

    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range:            "'App_Ganhos'!A:E",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          grupo.trim().toUpperCase(),
          item.trim(),
          Number(valor),
          confirmado ? "TRUE" : "FALSE",
          String(prazo ?? "").trim(),
        ]],
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/finance/ganho/add]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
