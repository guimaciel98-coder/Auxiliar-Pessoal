import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";
export const dynamic = "force-dynamic";

// Endpoint temporário — escreve pagas corretas direto na coluna F
// Valores corretos conforme usuário: Revisão=11, Assistencia=2, Capacete=9, Concerto=8, Jogo=2, Manual=2
const FIXES = [
  { row: 4,  pagas: 11 }, // Revisão Bike
  { row: 5,  pagas: 2  }, // Assistencia Computador
  { row: 6,  pagas: 9  }, // Capacete
  { row: 7,  pagas: 8  }, // Concerto Bike
  { row: 9,  pagas: 2  }, // Jogo Steam
  { row: 10, pagas: 2  }, // Manual (Cabelo)
];

export async function POST() {
  const sheets        = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const data = FIXES.map(f => ({
    range:  `'App_Parcelas'!F${f.row}`,
    values: [[f.pagas]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data },
  });

  return Response.json({ ok: true, fixed: FIXES.length });
}
