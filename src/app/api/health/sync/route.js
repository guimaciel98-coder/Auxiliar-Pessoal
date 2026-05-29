import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

/**
 * POST /api/health/sync
 *
 * Recebe payload do app "Health Auto Export" (iOS) e salva em App_Saude + App_Treinos.
 *
 * O app envia:
 * {
 *   "data": {
 *     "metrics": [
 *       { "name": "step_count",              "data": [{ "date": "YYYY-MM-DD ...", "qty": 8500 }] },
 *       { "name": "active_energy_burned",    "data": [{ "date": "...", "qty": 540 }] },
 *       { "name": "distance_walking_running","data": [{ "date": "...", "qty": 5.2 }] },
 *       { "name": "resting_heart_rate",      "data": [{ "date": "...", "qty": 62 }] },
 *       { "name": "heart_rate",              "data": [{ "date": "...", "qty": 75 }] },
 *       { "name": "sleep_analysis",          "data": [{ "date": "...", "qty": 7.2, "source": "..." }] },
 *       ...
 *     ],
 *     "workouts": [
 *       { "workoutActivityType": "HKWorkoutActivityTypeRunning", "duration": 35.5,
 *         "totalEnergyBurned": 320, "totalDistance": 5.1, "startDate": "YYYY-MM-DD ..." }
 *     ]
 *   }
 * }
 */

const TAB_SAUDE   = "App_Saude";
const TAB_TREINOS = "App_Treinos";

const WORKOUT_TYPES = {
  HKWorkoutActivityTypeRunning:            "Corrida",
  HKWorkoutActivityTypeCycling:            "Ciclismo",
  HKWorkoutActivityTypeWalking:            "Caminhada",
  HKWorkoutActivityTypeTraditionalStrengthTraining: "Musculação",
  HKWorkoutActivityTypeFunctionalStrengthTraining:  "Musculação",
  HKWorkoutActivityTypeYoga:               "Yoga",
  HKWorkoutActivityTypeSwimming:           "Natação",
  HKWorkoutActivityTypeHighIntensityIntervalTraining: "HIIT",
  HKWorkoutActivityTypeElliptical:         "Elíptico",
  HKWorkoutActivityTypeCrossTraining:      "Cross Training",
  HKWorkoutActivityTypeOther:              "Outro",
  Running:    "Corrida",
  Cycling:    "Ciclismo",
  Walking:    "Caminhada",
  Strength:   "Musculação",
  Yoga:       "Yoga",
  Swimming:   "Natação",
  HIIT:       "HIIT",
  Elliptical: "Elíptico",
};

function parseDate(raw) {
  // "2024-05-28 23:30:00 -0300" ou "2024-05-28" → "28/05/2024"
  const s = String(raw ?? "").trim().slice(0, 10);
  if (!s || !s.includes("-")) return null;
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return null;
  return `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${y}`;
}

function numFmt(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? "" : String(Math.round(n * 100) / 100).replace(".", ",");
}

function getMetric(metrics, name) {
  const m = metrics.find(x => x.name === name || x.name?.toLowerCase() === name.toLowerCase());
  if (!m || !Array.isArray(m.data) || m.data.length === 0) return null;
  // pega o item mais recente (último do dia ou único)
  const item = m.data[m.data.length - 1];
  return parseFloat(item?.qty ?? item?.value ?? item?.Qty ?? 0) || null;
}

function getSleep(metrics) {
  // sleep_analysis pode ter múltiplas entradas (InBed, Asleep, Core, Deep, REM)
  // queremos InBed (total) ou Asleep como sono total, e "AsleepDeep" como profundo
  const m = metrics.find(x => x.name === "sleep_analysis" || x.name === "sleep_duration");
  if (!m || !Array.isArray(m.data)) return { total: null, deep: null };

  let total = 0, deep = 0;
  for (const item of m.data) {
    const qty = parseFloat(item?.qty ?? item?.value ?? 0) || 0;
    const src = String(item?.source ?? item?.sleepStage ?? "").toLowerCase();
    if (src.includes("deep")) {
      deep += qty;
    } else if (!src.includes("awake") && !src.includes("rem") && !src.includes("core")) {
      total += qty;
    }
  }
  // Se não tem distinção, soma tudo como total
  if (total === 0) {
    for (const item of m.data) {
      total += parseFloat(item?.qty ?? item?.value ?? 0) || 0;
    }
  }
  return {
    total: total > 0 ? total : null,
    deep:  deep  > 0 ? deep  : null,
  };
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

  // Suporta tanto { data: { metrics, workouts } } quanto { metrics, workouts } direto
  const payload  = body?.data ?? body;
  const metrics  = Array.isArray(payload?.metrics)  ? payload.metrics  : [];
  const workouts = Array.isArray(payload?.workouts) ? payload.workouts : [];

  if (metrics.length === 0 && workouts.length === 0) {
    return Response.json({ ok: false, error: "Nenhum dado recebido" }, { status: 400 });
  }

  // ── Determina a data do envio ─────────────────────────────────────────────
  // v2 envia dados agrupados por dia — pega a data mais recente
  let date = null;
  for (const m of metrics) {
    if (Array.isArray(m.data) && m.data.length > 0) {
      const d = parseDate(m.data[m.data.length - 1]?.date);
      if (d) { date = d; break; }
    }
  }
  if (!date && workouts.length > 0) {
    date = parseDate(workouts[workouts.length - 1]?.start ?? workouts[workouts.length - 1]?.startDate);
  }
  if (!date) {
    const d = new Date(Date.now() - 3 * 3600 * 1000);
    date = `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
  }

  // ── Extrai métricas ───────────────────────────────────────────────────────
  const steps    = getMetric(metrics, "step_count")               ?? getMetric(metrics, "steps");
  const calories = getMetric(metrics, "active_energy_burned")     ?? getMetric(metrics, "active_energy")
                ?? getMetric(metrics, "calories");
  const distance = getMetric(metrics, "distance_walking_running") ?? getMetric(metrics, "walking_running_distance")
                ?? getMetric(metrics, "distance");
  const bpmRest  = getMetric(metrics, "resting_heart_rate")       ?? getMetric(metrics, "heart_rate_resting");
  const bpmAvg   = getMetric(metrics, "heart_rate");
  const sleep    = getSleep(metrics);

  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // ── App_Saude: upsert ──────────────────────────────────────────────────
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `'${TAB_SAUDE}'!A2:H9999`,
    });
    const rows     = existing.data.values ?? [];
    const rowIndex = rows.findIndex(r => String(r[0] ?? "").trim() === date);

    const cur = rowIndex >= 0 ? (rows[rowIndex] ?? []) : [];
    const merged = [[
      date,
      steps      != null ? numFmt(steps)         : (cur[1] ?? ""),
      calories   != null ? numFmt(calories)       : (cur[2] ?? ""),
      distance   != null ? numFmt(distance)       : (cur[3] ?? ""),
      bpmRest    != null ? numFmt(bpmRest)        : (cur[4] ?? ""),
      bpmAvg     != null ? numFmt(bpmAvg)         : (cur[5] ?? ""),
      sleep.total != null ? numFmt(sleep.total)   : (cur[6] ?? ""),
      sleep.deep  != null ? numFmt(sleep.deep)    : (cur[7] ?? ""),
    ]];

    if (rowIndex >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${TAB_SAUDE}'!A${rowIndex + 2}:H${rowIndex + 2}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: merged },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${TAB_SAUDE}'!A:H`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: merged },
      });
    }

    // ── App_Treinos: deduplicado ───────────────────────────────────────────
    let workoutsWritten = 0;
    if (workouts.length > 0) {
      const treinosRes = await sheets.spreadsheets.values.get({
        spreadsheetId, range: `'${TAB_TREINOS}'!A2:E9999`,
      });
      const existingKeys = new Set(
        (treinosRes.data.values ?? []).map(r => `${r[0]}|${r[1]}|${r[2]}`)
      );

      const newRows = workouts.map(w => {
        // v2: { name, start, duration, activeEnergy: {qty}, distance: {qty} }
        // v1: { workoutActivityType, startDate, duration, totalEnergyBurned, totalDistance }
        const wDate = parseDate(w.start ?? w.startDate ?? w.date) ?? date;
        const tipo  = WORKOUT_TYPES[w.workoutActivityType] ?? WORKOUT_TYPES[w.name] ?? WORKOUT_TYPES[w.type] ?? "Outro";
        const dur   = Math.round(parseFloat(w.duration ?? w.duration_min ?? 0));
        const cal   = parseFloat(w.activeEnergy?.qty ?? w.totalEnergyBurned ?? w.calorias ?? 0) || "";
        const dist  = parseFloat(w.distance?.qty ?? w.totalDistance ?? w.distancia_km ?? 0) || "";
        return [wDate, tipo, dur, cal, dist];
      }).filter(r => r[2] > 0 && !existingKeys.has(`${r[0]}|${r[1]}|${r[2]}`));

      if (newRows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${TAB_TREINOS}'!A:E`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: newRows },
        });
        workoutsWritten = newRows.length;
      }
    }

    return Response.json({ ok: true, date, workouts_written: workoutsWritten });
  } catch (e) {
    console.error("[POST /api/health/sync]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
