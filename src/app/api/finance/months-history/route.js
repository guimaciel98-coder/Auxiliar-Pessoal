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

    const res  = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${HIST}'!A2:H500` });
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
        parcelas:  parseNum(r[7]),
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

// PATCH — recalcula saldo de todos os registros históricos incluindo parcelas
export async function PATCH() {
  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const [histRes, parcelasRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: `'${HIST}'!A2:H500` }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Parcelas'!A2:I300" })
        .catch(() => ({ data: { values: [] } })),
    ]);

    const rows = histRes.data.values ?? [];

    // Soma valorMensal das parcelas ativas
    const totalParcelas = (parcelasRes.data.values ?? []).reduce((s, row) => {
      if (String(row[7] ?? "TRUE").toUpperCase() === "FALSE") return s;
      if (!String(row[0] ?? "").trim()) return s;
      return s + (parseFloat(String(row[3] ?? "0").replace(",", ".")) || 0);
    }, 0);
    function toSheetNum(n) { return Number(n).toFixed(2).replace(".", ","); }

    const updates = [];
    rows.forEach((row, i) => {
      if (!row[0]?.trim()) return;
      const ganhos    = parseNum(row[2]);
      const fixos     = parseNum(row[3]);
      const variaveis = parseNum(row[4]);
      const saldo     = ganhos - fixos - variaveis - totalParcelas;
      updates.push({ range: `'${HIST}'!G${i + 2}`, values: [[toSheetNum(saldo)]] });
      updates.push({ range: `'${HIST}'!H${i + 2}`, values: [[toSheetNum(totalParcelas)]] });
    });

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data: updates },
      });
    }

    return Response.json({ ok: true, rowsFixed: rows.filter(r => r[0]?.trim()).length, totalParcelas });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
