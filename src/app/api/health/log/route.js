import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

/**
 * POST /api/health/log
 *
 * Recebe dados de saúde do Atalho do iPhone e salva em App_Saude.
 * Requer header: Authorization: Bearer <HEALTH_API_KEY>
 *
 * Body: {
 *   date?:            "DD/MM/YYYY"  — padrão: hoje
 *   steps?:           number
 *   calories?:        number
 *   distance_km?:     number
 *   bpm_rest?:        number
 *   bpm_avg?:         number
 *   sleep_h?:         number
 *   sleep_deep_h?:    number
 * }
 */

const TAB = "App_Saude";

function todayBR() {
  const d  = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function num(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? "" : String(n).replace(".", ",");
}

export async function POST(req) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const apiKey = process.env.HEALTH_API_KEY;
  if (apiKey) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth.replace("Bearer ", "").trim() !== apiKey) {
      return Response.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
  }

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const date = String(body.date ?? todayBR()).trim();

  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // Verifica se já existe linha para essa data — se sim, atualiza
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${TAB}'!A2:A9999`,
    });

    const rows     = existing.data.values ?? [];
    const rowIndex = rows.findIndex(r => String(r[0] ?? "").trim() === date);

    const values = [[
      date,
      num(body.steps),
      num(body.calories),
      num(body.distance_km),
      num(body.bpm_rest),
      num(body.bpm_avg),
      num(body.sleep_h),
      num(body.sleep_deep_h),
    ]];

    if (rowIndex >= 0) {
      // Linha existe → atualiza (rowIndex+2 porque começa em A2)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${TAB}'!A${rowIndex + 2}:H${rowIndex + 2}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
    } else {
      // Linha nova → append
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${TAB}'!A:H`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
    }

    return Response.json({ ok: true, date, action: rowIndex >= 0 ? "updated" : "appended" });
  } catch (e) {
    console.error("[POST /api/health/log]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
