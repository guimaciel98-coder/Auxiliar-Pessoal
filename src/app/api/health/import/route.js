import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function toNum(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(".", ",");
}

/**
 * POST /api/health/import
 * Body: { days, workouts, update_sleep?, clear? }
 *   clear:        true → limpa App_Saude e App_Treinos antes de importar
 *   days:         [{ date, steps, calories, distance_km, bpm_avg, sleep_h, sleep_deep_h }]
 *   workouts:     [{ date, tipo, duracao_min, calorias, distancia_km }]
 *   update_sleep: true → atualiza colunas G:H (sono) em linhas já existentes
 */
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const { days = [], workouts = [], update_sleep = false, update_bpm = false, clear = false } = body;
  if (!clear && !days.length && !workouts.length) {
    return Response.json({ ok: false, error: "Nenhum dado recebido" }, { status: 400 });
  }

  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // ── Modo clear: limpa as abas antes de reimportar ────────────────────
    if (clear) {
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: "'App_Saude'!A2:H9999" });
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: "'App_Treinos'!A2:E9999" })
        .catch(() => {});
      return Response.json({ ok: true, cleared: true });
    }

    // ── Modo update_sleep: atualiza G:H para datas existentes ────────────
    if (update_sleep) {
      const existingData = await sheets.spreadsheets.values.get({
        spreadsheetId, range: "'App_Saude'!A2:H9999",
      }).catch(() => ({ data: { values: [] } }));

      const rows = existingData.data.values ?? [];
      const dateToRow = {};
      rows.forEach((row, idx) => {
        const date = String(row[0] ?? "").trim();
        if (date) dateToRow[date] = idx + 2; // +2: linha 1 = header, idx 0 = linha 2
      });

      const batchData = [];
      for (const d of days) {
        if (!d.date || !dateToRow[d.date]) continue;
        const rowNum = dateToRow[d.date];
        batchData.push({
          range:  `'App_Saude'!G${rowNum}:H${rowNum}`,
          values: [[toNum(d.sleep_h), toNum(d.sleep_deep_h)]],
        });
      }

      if (batchData.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < batchData.length; i += BATCH) {
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
              valueInputOption: "RAW",
              data: batchData.slice(i, i + BATCH),
            },
          });
        }
      }

      return Response.json({ ok: true, sleep_updated: batchData.length });
    }

    // ── Modo update_bpm: atualiza E:F (bpm_rest, bpm_avg) para datas existentes ──
    if (update_bpm) {
      const existingData = await sheets.spreadsheets.values.get({
        spreadsheetId, range: "'App_Saude'!A2:H9999",
      }).catch(() => ({ data: { values: [] } }));

      const rows = existingData.data.values ?? [];
      const dateToRow = {};
      rows.forEach((row, idx) => {
        const date = String(row[0] ?? "").trim();
        if (date) dateToRow[date] = idx + 2;
      });

      const batchData = [];
      for (const d of days) {
        if (!d.date || !dateToRow[d.date]) continue;
        const rowNum = dateToRow[d.date];
        batchData.push({
          range:  `'App_Saude'!E${rowNum}:F${rowNum}`,
          values: [[toNum(d.bpm_rest), toNum(d.bpm_avg)]],
        });
      }

      if (batchData.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < batchData.length; i += BATCH) {
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: { valueInputOption: "RAW", data: batchData.slice(i, i + BATCH) },
          });
        }
      }
      return Response.json({ ok: true, bpm_updated: batchData.length });
    }

    // ── Lê datas já existentes em App_Saude ──────────────────────────────
    const existingSaude = await sheets.spreadsheets.values.get({
      spreadsheetId, range: "'App_Saude'!A2:A9999",
    }).catch(() => ({ data: { values: [] } }));
    const existingDays = new Set(
      (existingSaude.data.values ?? []).map(r => String(r[0] ?? "").trim())
    );

    // ── Lê treinos já existentes em App_Treinos ───────────────────────────
    const existingTreinos = await sheets.spreadsheets.values.get({
      spreadsheetId, range: "'App_Treinos'!A2:C9999",
    }).catch(() => ({ data: { values: [] } }));
    const existingWorkoutKeys = new Set(
      (existingTreinos.data.values ?? []).map(r => `${r[0]}|${r[1]}|${r[2]}`)
    );

    // ── Filtra e escreve novos dias em App_Saude ──────────────────────────
    const newDays = days.filter(d => d.date && !existingDays.has(d.date));
    let daysWritten = 0;
    const CHUNK = 200;
    for (let i = 0; i < newDays.length; i += CHUNK) {
      const chunk  = newDays.slice(i, i + CHUNK);
      const values = chunk.map(d => [
        d.date,
        toNum(d.steps),
        toNum(d.calories),
        toNum(d.distance_km),
        "",               // BPM_Repouso (não disponível no export)
        toNum(d.bpm_avg),
        toNum(d.sleep_h),
        toNum(d.sleep_deep_h),
      ]);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range:            "'App_Saude'!A:H",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody:      { values },
      });
      daysWritten += chunk.length;
    }

    // ── Garante que App_Treinos existe ───────────────────────────────────
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetNames  = spreadsheet.data.sheets.map(s => s.properties.title);
    if (!sheetNames.includes("App_Treinos")) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: "App_Treinos" } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range:            "'App_Treinos'!A1:E1",
        valueInputOption: "RAW",
        requestBody:      { values: [["Data", "Tipo", "Duracao_min", "Calorias", "Distancia_km"]] },
      });
    }

    // ── Filtra e escreve App_Treinos ──────────────────────────────────────
    const newWorkouts = workouts.filter(w => {
      const key = `${w.date}|${w.tipo}|${w.duracao_min}`;
      return w.date && !existingWorkoutKeys.has(key);
    });
    let workoutsWritten = 0;
    for (let i = 0; i < newWorkouts.length; i += CHUNK) {
      const chunk  = newWorkouts.slice(i, i + CHUNK);
      const values = chunk.map(w => [
        w.date,
        w.tipo,
        toNum(w.duracao_min),
        toNum(w.calorias),
        toNum(w.distancia_km),
      ]);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range:            "'App_Treinos'!A:E",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody:      { values },
      });
      workoutsWritten += chunk.length;
    }

    return Response.json({ ok: true, days_written: daysWritten, workouts_written: workoutsWritten });
  } catch (e) {
    console.error("[POST /api/health/import]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
