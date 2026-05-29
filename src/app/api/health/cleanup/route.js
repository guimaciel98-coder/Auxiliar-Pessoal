import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

// Mantém apenas registros a partir de 01/01/2025
const CUTOFF = new Date(2025, 0, 1).getTime(); // Jan 2025

function parseDateBR(s) {
  const [d, m, y] = String(s ?? "").split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d).getTime() : 0;
}

async function cleanTab(sheets, spreadsheetId, tab, headerRange) {
  const res  = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A1:Z9999` });
  const all  = res.data.values ?? [];
  if (all.length < 2) return { removed: 0, kept: 0 };

  const header = all[0];
  const rows   = all.slice(1);
  const before = rows.length;
  const kept   = rows.filter(r => parseDateBR(r[0]) >= CUTOFF);
  const removed = before - kept.length;

  // Limpa tudo e re-escreve header + dados filtrados
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${tab}'!A1:Z9999` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [header, ...kept] },
  });

  return { removed, kept: kept.length };
}

export async function POST() {
  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const saude   = await cleanTab(sheets, spreadsheetId, "App_Saude",   "A1:H1");
    const treinos = await cleanTab(sheets, spreadsheetId, "App_Treinos", "A1:E1");

    return Response.json({
      ok: true,
      saude:   { removed: saude.removed,   kept: saude.kept },
      treinos: { removed: treinos.removed, kept: treinos.kept },
    });
  } catch (e) {
    console.error("[POST /api/health/cleanup]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
