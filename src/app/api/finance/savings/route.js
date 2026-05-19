import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

// Aba oficial de poupança: A=Mes | B=Valor | C=Atingido (checkbox TRUE/FALSE)
const SHEET = "App_Poupanca";

function parseNum(raw) {
  return (
    parseFloat(
      String(raw ?? "0").trim()
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    ) || 0
  );
}

export async function GET() {
  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET}'!A2:C100`,
    });

    const historico = [];
    for (const row of res.data.values ?? []) {
      const mes     = String(row[0] ?? "").trim();
      const valor   = parseNum(row[1] ?? "0");
      const atingido = String(row[2] ?? "").toUpperCase() === "TRUE";
      if (!mes || !valor) continue;
      historico.push({ mes, valor, atingido });
    }

    // Acumulado = valor do último mês atingido (coluna B já é cumulativo na planilha)
    const atingidos = historico.filter(m => m.atingido);
    const acumulado = atingidos.length > 0 ? atingidos[atingidos.length - 1].valor : 0;

    return Response.json({ ok: true, acumulado, historico, source: SHEET });
  } catch (e) {
    console.error("[GET /api/finance/savings]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
