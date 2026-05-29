import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

/**
 * POST /api/health/log
 *
 * Recebe dados de saúde do Atalho do iPhone e salva em App_Saude + App_Treinos.
 * Requer header: Authorization: Bearer <HEALTH_API_KEY>
 *
 * Body: {
 *   date?:            "DD/MM/YYYY"  — padrão: hoje (BRT)
 *   steps?:           number
 *   calories?:        number
 *   distance_km?:     number
 *   bpm_rest?:        number
 *   bpm_avg?:         number
 *   sleep_h?:         number
 *   sleep_deep_h?:    number
 *   workouts?: [{
 *     tipo:         string       — "Corrida", "Ciclismo", etc.
 *     duracao_min:  number
 *     calorias?:    number
 *     distancia_km?: number
 *   }]
 * }
 */

const TAB_SAUDE    = "App_Saude";
const TAB_TREINOS  = "App_Treinos";

function todayBR() {
  const d  = new Date(Date.now() - 3 * 3600 * 1000); // BRT
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function num(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? "" : n;
}

function numStr(v) {
  const n = num(v);
  return n === "" ? "" : String(n).replace(".", ",");
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

    // ── App_Saude: upsert da linha do dia ─────────────────────────────────────
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${TAB_SAUDE}'!A2:A9999`,
    });
    const rows     = existing.data.values ?? [];
    const rowIndex = rows.findIndex(r => String(r[0] ?? "").trim() === date);

    const saudeRow = [[
      date,
      numStr(body.steps),
      numStr(body.calories),
      numStr(body.distance_km),
      numStr(body.bpm_rest),
      numStr(body.bpm_avg),
      numStr(body.sleep_h),
      numStr(body.sleep_deep_h),
    ]];

    let saudeAction;
    if (rowIndex >= 0) {
      // Atualiza apenas campos presentes (não sobrescreve vazios com blank)
      const existingFull = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${TAB_SAUDE}'!A${rowIndex + 2}:H${rowIndex + 2}`,
      });
      const cur = existingFull.data.values?.[0] ?? [];
      const merged = [[
        date,
        num(body.steps)        !== "" ? numStr(body.steps)        : (cur[1] ?? ""),
        num(body.calories)     !== "" ? numStr(body.calories)     : (cur[2] ?? ""),
        num(body.distance_km)  !== "" ? numStr(body.distance_km)  : (cur[3] ?? ""),
        num(body.bpm_rest)     !== "" ? numStr(body.bpm_rest)     : (cur[4] ?? ""),
        num(body.bpm_avg)      !== "" ? numStr(body.bpm_avg)      : (cur[5] ?? ""),
        num(body.sleep_h)      !== "" ? numStr(body.sleep_h)      : (cur[6] ?? ""),
        num(body.sleep_deep_h) !== "" ? numStr(body.sleep_deep_h) : (cur[7] ?? ""),
      ]];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${TAB_SAUDE}'!A${rowIndex + 2}:H${rowIndex + 2}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: merged },
      });
      saudeAction = "updated";
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${TAB_SAUDE}'!A:H`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: saudeRow },
      });
      saudeAction = "appended";
    }

    // ── App_Treinos: insere treinos do dia (deduplicado por data+tipo+duração) ─
    let workoutsWritten = 0;
    const workouts = Array.isArray(body.workouts) ? body.workouts : [];

    if (workouts.length > 0) {
      const treinosRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${TAB_TREINOS}'!A2:E9999`,
      });
      const existingTreinos = treinosRes.data.values ?? [];
      const existingKeys = new Set(
        existingTreinos.map(r => `${String(r[0]??"")}|${String(r[1]??"")}|${String(r[2]??"")}`)
      );

      const newTreinos = workouts
        .filter(w => w.tipo && w.duracao_min > 0)
        .map(w => [
          date,
          String(w.tipo).trim(),
          num(w.duracao_min),
          num(w.calorias) !== "" ? num(w.calorias) : "",
          num(w.distancia_km) !== "" ? num(w.distancia_km) : "",
        ])
        .filter(row => !existingKeys.has(`${row[0]}|${row[1]}|${row[2]}`));

      if (newTreinos.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${TAB_TREINOS}'!A:E`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: newTreinos },
        });
        workoutsWritten = newTreinos.length;
      }
    }

    return Response.json({ ok: true, date, action: saudeAction, workouts_written: workoutsWritten });
  } catch (e) {
    console.error("[POST /api/health/log]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
