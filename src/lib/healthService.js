/**
 * healthService.js — Google Sheets API · Módulo Saúde
 *
 * App_Saude: A:Data | B:Passos | C:Calorias | D:Distancia_km |
 *            E:BPM_Repouso | F:BPM_Media | G:Sono_h | H:Sono_Profundo_h
 */

import { getSheetsClient, getSpreadsheetId } from "./googleSheets";

function parseNum(raw) {
  const s = String(raw ?? "").trim().replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseDateBR(s) {
  const [d, m, y] = String(s ?? "").trim().split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

function parseNumBR(raw) {
  const s = String(raw ?? "").trim().replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export async function fetchHealthData() {
  const sheets        = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const [saudeRes, treinosRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Saude'!A2:H9999" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "'App_Treinos'!A2:E9999" })
      .catch(() => ({ data: { values: [] } })),
  ]);

  // ── Treinos ──────────────────────────────────────────────────────────────
  const workouts = (treinosRes.data.values ?? [])
    .map(row => {
      const date = String(row[0] ?? "").trim();
      if (!date) return null;
      return {
        date,
        tipo:         String(row[1] ?? "").trim() || "Outro",
        duracao_min:  parseNumBR(row[2]),
        calorias:     parseNumBR(row[3]),
        distancia_km: parseNumBR(row[4]),
      };
    })
    .filter(Boolean);

  const res = saudeRes;

  const rows = res.data.values ?? [];

  // Deduplicar por data: mescla múltiplas linhas da mesma data num único registro
  const byDate = new Map();
  for (const row of rows) {
    const date = String(row[0] ?? "").trim();
    if (!date) continue;
    const d = parseDateBR(date);
    if (!d) continue;

    const existing = byDate.get(date);
    const parsed = {
      date,
      ts:           d.getTime(),
      steps:        parseNum(row[1]),
      calories:     parseNum(row[2]),
      distance_km:  parseNum(row[3]),
      bpm_rest:     parseNum(row[4]),
      bpm_avg:      parseNum(row[5]),
      sleep_h:      parseNum(row[6]),
      sleep_deep_h: parseNum(row[7]),
    };

    if (!existing) {
      byDate.set(date, parsed);
    } else {
      // Mantém o valor não-nulo de cada campo (merge)
      for (const key of ["steps","calories","distance_km","bpm_rest","bpm_avg","sleep_h","sleep_deep_h"]) {
        if (existing[key] === null && parsed[key] !== null) existing[key] = parsed[key];
      }
    }
  }

  const days = Array.from(byDate.values())
    .map(d => ({
      ...d,
      // BPM: usa repouso se disponível, senão média (Zepp não exporta repouso)
      bpm_rest: d.bpm_rest ?? d.bpm_avg ?? null,
    }))
    .sort((a, b) => b.ts - a.ts);

  // Médias dos últimos 30 dias
  const last30 = days.slice(0, 30);
  function avg(key) {
    const vals = last30.map(d => d[key]).filter(v => v !== null);
    return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
  }

  return {
    days,
    workouts,
    averages: {
      steps:       avg("steps"),
      calories:    avg("calories"),
      distance_km: avg("distance_km"),
      bpm_rest:    avg("bpm_rest"),
      sleep_h:     avg("sleep_h"),
    },
  };
}
