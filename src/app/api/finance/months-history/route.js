import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

const HIST = "App_Historico_Meses";

function parseNum(raw) {
  return parseFloat(String(raw ?? "0").trim().replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

export async function GET() {
  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const res  = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${HIST}'!A2:G500` });
    const rows = res.data.values ?? [];

    const months = rows
      .filter(r => r[0]?.trim())
      .map(r => ({
        ciclo:     r[0] ?? "",
        fechadoEm: r[1] ?? "",
        ganhos:    parseNum(r[2]),
        fixos:     parseNum(r[3]),
        variaveis: parseNum(r[4]),
        poupanca:  parseNum(r[5]),
        saldo:     parseNum(r[6]),
      }))
      .reverse();

    return Response.json({ ok: true, months });
  } catch (e) {
    if (e.message?.includes("Unable to parse range") || e.code === 400) {
      return Response.json({ ok: true, months: [] });
    }
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
