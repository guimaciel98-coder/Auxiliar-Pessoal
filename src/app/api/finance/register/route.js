import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { type, grupo, nome, previsao, auto = false } = await req.json();
    if (!type || !nome?.trim()) {
      return Response.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }
    const tab = type === "variavel" ? "App_Gastos_Variaveis" : "App_Gastos_Fixos";
    const sheets = await getSheetsClient();
    const ssId   = getSpreadsheetId();
    // Variável: A:Grupo | B:Item | C:Previsao | D:Real(0) | E:Controle(FALSE)
    // Fixo:     A:Grupo | B:Item | C:Previsao | D:Real(0) | E:Controle(FALSE) | F:Auto
    const row = type === "fixo"
      ? [grupo || "Outros", nome.trim(), previsao || 0, 0, "FALSE", auto ? "TRUE" : "FALSE"]
      : [grupo || "Outros", nome.trim(), previsao || 0, 0, "FALSE"];
    await sheets.spreadsheets.values.append({
      spreadsheetId: ssId,
      range: `'${tab}'!A:${type === "fixo" ? "F" : "E"}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/finance/register]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// PATCH — atualiza o valor previsto de um gasto variável pelo nome do item
export async function PATCH(req) {
  try {
    const { nome, previsao } = await req.json();
    if (!nome?.trim() || previsao == null) {
      return Response.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }
    const sheets = await getSheetsClient();
    const ssId   = getSpreadsheetId();

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: "'App_Gastos_Variaveis'!A2:C500",
    });
    const rows = res.data.values ?? [];
    const idx  = rows.findIndex(r => String(r[1] ?? "").trim().toLowerCase() === nome.trim().toLowerCase());
    if (idx === -1) {
      return Response.json({ ok: false, error: "Item não encontrado" }, { status: 404 });
    }
    const sheetRow = idx + 2; // header na linha 1, dados a partir da 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: ssId,
      range: `'App_Gastos_Variaveis'!C${sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[previsao]] },
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/finance/register]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
