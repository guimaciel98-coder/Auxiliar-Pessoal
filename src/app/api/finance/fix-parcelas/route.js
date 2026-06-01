import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";
export const dynamic = "force-dynamic";

const FIXES = [
  { row: 4,  pagas: 11 }, // Revisão Bike
  { row: 5,  pagas: 2  }, // Assistencia Computador
  { row: 6,  pagas: 9  }, // Capacete
  { row: 7,  pagas: 8  }, // Concerto Bike
  { row: 9,  pagas: 2  }, // Jogo Steam
  { row: 10, pagas: 2  }, // Manual (Cabelo)
];

export async function GET() {
  // Debug: lê o conteúdo real de F (fórmula ou valor)
  const sheets        = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "'App_Parcelas'!A2:F15",
    valueRenderOption: "FORMULA",
  });
  return Response.json({ rows: res.data.values });
}

export async function POST() {
  const sheets        = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // Usa update individual por célula com RAW para garantir sobrescrever fórmula
  for (const f of FIXES) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range:            `'App_Parcelas'!F${f.row}`,
      valueInputOption: "RAW",
      requestBody:      { values: [[f.pagas]] },
    });
  }

  // Lê de volta para confirmar
  const check = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "'App_Parcelas'!F4:F12",
    valueRenderOption: "FORMATTED_VALUE",
  });

  return Response.json({ ok: true, fixed: FIXES.length, f_values: check.data.values });
}
