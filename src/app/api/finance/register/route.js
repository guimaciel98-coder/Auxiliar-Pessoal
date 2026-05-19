import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { type, grupo, nome, previsao } = await req.json();
    if (!type || !nome?.trim()) {
      return Response.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }
    const tab = type === "variavel" ? "App_Gastos_Variaveis" : "App_Gastos_Fixos";
    const sheets = await getSheetsClient();
    const ssId   = getSpreadsheetId();
    // Row: A:Grupo | B:Item | C:Previsao | D:Real(0) | E:Controle(FALSE)
    await sheets.spreadsheets.values.append({
      spreadsheetId: ssId,
      range: `'${tab}'!A:E`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[grupo || "Outros", nome.trim(), previsao || 0, 0, "FALSE"]] },
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/finance/register]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
