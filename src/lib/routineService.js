/**
 * routineService.js
 *
 * Lê a aba "Rotina" da planilha de rotina e transforma em timeline diária.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * Estrutura real mapeada em 2026-05-10
 * Planilha: 13y2HHURgSwQp9k29w8IF6V8_QEZNskMF7j0ENOM8Gpk
 * Aba: "Rotina" (sheetId 342520350)
 * ───────────────────────────────────────────────────────────────────────────────
 *
 *  Linha 1  (índice 0): cabeçalho
 *    A(0)="" · B(1)="" · C(2)="Segunda-feira" · D(3)="Terça-feira"
 *    E(4)="Quarta-feira" · F(5)="Quinta-feira" · G(6)="Sexta-feira"
 *    H(7)="Sábado" · I(8)="Domingo"
 *
 *  Linhas 2+ (índice 1+): dados
 *    A(0): duração textual ("5 min", "1h", "2h45")
 *    B(1): faixa horária ("06h - 06h05", "09h15 - 12h", "22h - 01h")
 *    C–I : atividade por dia da semana (Segunda a Domingo)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { getSheetsClient, normalize } from "./googleSheets";

// ─── IDs ───────────────────────────────────────────────────────────────────────
const ROUTINE_SPREADSHEET_ID =
  process.env.GOOGLE_ROUTINE_SPREADSHEET_ID ??
  "13y2HHURgSwQp9k29w8IF6V8_QEZNskMF7j0ENOM8Gpk";

// "Rotina Treino Manhâ": A=horário | B=Seg | C=Ter | D=Qua | E=Qui | F=Sex | G=Sáb | H=Dom
const ROUTINE_SHEET_NAME = "Rotina Treino Manhâ";

// ─── Mapeamento dia JS (0=Dom) → índice de coluna na planilha ─────────────────
const WEEKDAY_TO_COL = {
  0: 7, // Domingo   → H
  1: 1, // Segunda   → B
  2: 2, // Terça     → C
  3: 3, // Quarta    → D
  4: 4, // Quinta    → E
  5: 5, // Sexta     → F
  6: 6, // Sábado    → G
};

const WEEKDAY_NAMES = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

// ─── Categorias ────────────────────────────────────────────────────────────────
const CATEGORIES = {
  treino:   { label: "Treino",   color: "#9c27b0" },
  trabalho: { label: "Trabalho", color: "#2196f3" },
  pessoal:  { label: "Pessoal",  color: "#00e5a0" },
  livre:    { label: "Livre",    color: "#484f58" },
};

// Palavras-chave para detecção por texto (fallback quando sem cor)
const KEYWORD_MAP = [
  {
    cat: "treino",
    words: [
      "musculação","musculacao","natação","natacao","corrida","treino",
      "perna","costas","peito","ombro","biceps","triceps","tríceps",
      "cardio","crossfit","whey","ginástica","ginastica","arrumar treino",
    ],
  },
  {
    cat: "trabalho",
    words: [
      "vca","ponto de vista","trabalho","reunião","reuniao","clientes",
      "pdv","produção","producao","edição","edicao","call","meeting",
      "ida trabalho","volta casa",
    ],
  },
  {
    cat: "pessoal",
    words: [
      "acordar","meditação","meditacao","banho","café","cafe","almoço",
      "almoco","lanche","janta","fruta","casa","descanso","leitura",
      "organizar","comida","família","familia","lazer","estudo","hobby",
      "dormir","arrumar trabalho",
    ],
  },
];

// ─── Helpers de cor (para leitura com includeGridData) ────────────────────────

function rgbToHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d   = max - min;
  if (d === 0) return 0;
  let h;
  if      (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else                h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

function categoryFromColor(bgColor) {
  if (!bgColor) return null;
  const { red = 1, green = 1, blue = 1 } = bgColor;
  if ((red + green + blue) / 3 > 0.95) return null;
  const sat = Math.max(red, green, blue) - Math.min(red, green, blue);
  if (sat < 0.1) return null;
  const hue = rgbToHue(red, green, blue);
  if (hue >= 260 && hue <= 320) return "treino";
  if (hue >= 180 && hue <  260) return "trabalho";
  if (hue >= 80  && hue <  180) return "pessoal";
  return null;
}

function categoryFromText(text) {
  const n = normalize(text);
  for (const { cat, words } of KEYWORD_MAP) {
    if (words.some(w => n.includes(normalize(w)))) return cat;
  }
  return "livre";
}

// ─── Parsers de horário ────────────────────────────────────────────────────────

/**
 * Converte "HHhMM" ou "HHh" para minutos desde meia-noite.
 * Ex: "06h05" → 365, "12h" → 720, "01h" → 60
 */
function parseHhm(str) {
  const m = String(str ?? "").trim().match(/^(\d{1,2})h(\d{2})?$/i);
  if (!m) return -1;
  return parseInt(m[1]) * 60 + parseInt(m[2] ?? "0");
}

/**
 * Parseia a faixa horária da coluna B.
 * Ex: "06h - 06h05" → { time: "06:00", minutes: 360, duration: 5 }
 *     "22h - 01h"   → { time: "22:00", minutes: 1320, duration: 180 }
 */
function parseTimeRange(rangeStr) {
  const parts = String(rangeStr ?? "").split("-").map(s => s.trim());
  if (parts.length < 2) return null;

  const startMin = parseHhm(parts[0]);
  if (startMin === -1) return null;

  const endMin   = parseHhm(parts[1]);
  let   duration = 60;
  if (endMin !== -1) {
    duration = endMin >= startMin
      ? endMin - startMin
      : (endMin + 1440) - startMin; // passa da meia-noite
  }

  const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
  const mm = String(startMin % 60).padStart(2, "0");

  return { time: `${hh}:${mm}`, minutes: startMin, duration: Math.max(duration, 0) };
}

// ─── Leitura da planilha ──────────────────────────────────────────────────────

async function readRoutineSheet() {
  const sheets = await getSheetsClient();

  // Lê dados + metadados de merges em paralelo
  const [dataRes, metaRes] = await Promise.all([
    sheets.spreadsheets.get({
      spreadsheetId:   ROUTINE_SPREADSHEET_ID,
      ranges:          [`'${ROUTINE_SHEET_NAME}'!A:H`],
      includeGridData: true,
      fields:          "sheets.data.rowData.values(formattedValue,effectiveFormat.backgroundColor)",
    }),
    sheets.spreadsheets.get({
      spreadsheetId:   ROUTINE_SPREADSHEET_ID,
      includeGridData: false,
      fields:          "sheets(properties.title,merges)",
    }),
  ]);

  const rawRows = dataRes.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const merges  = metaRes.data.sheets?.find(s => s.properties.title === ROUTINE_SHEET_NAME)?.merges ?? [];

  // Constrói grid mutável
  const grid = rawRows.map(r => (r.values ?? []).map(c => ({
    formattedValue:  c.formattedValue  ?? "",
    effectiveFormat: c.effectiveFormat ?? null,
  })));

  // Propaga o valor/cor da célula topo-esquerda de cada fusão para todas as células da fusão
  for (const { startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec } of merges) {
    const baseVal   = grid[sr]?.[sc]?.formattedValue  ?? "";
    const baseColor = grid[sr]?.[sc]?.effectiveFormat ?? null;
    for (let r = sr; r < er; r++) {
      for (let c = sc; c < ec; c++) {
        if (r === sr && c === sc) continue;
        if (!grid[r]) grid[r] = [];
        if (!grid[r][c]) grid[r][c] = { formattedValue: "", effectiveFormat: null };
        if (!grid[r][c].formattedValue) grid[r][c].formattedValue  = baseVal;
        if (!grid[r][c].effectiveFormat) grid[r][c].effectiveFormat = baseColor;
      }
    }
  }

  return grid.map(row => ({ values: row }));
}

// ─── Parser da tabela principal ───────────────────────────────────────────────

/**
 * Transforma as linhas brutas em blocos de timeline para o dia informado.
 * @param {Array}  rowData - rowData retornado pela API com includeGridData
 * @param {number} dayCol  - índice da coluna do dia (2=Seg … 8=Dom)
 */
function parseMainTable(rowData, dayCol) {
  const blocks = [];

  for (let i = 0; i < rowData.length; i++) {
    const row = rowData[i];
    if (!row?.values?.length) continue;

    // Pula o cabeçalho (linha 1 = índice 0)
    if (i === 0) continue;

    const timeRangeRaw = row.values[0]?.formattedValue ?? ""; // coluna A
    const activityRaw  = row.values[dayCol]?.formattedValue ?? ""; // coluna do dia
    const bgColor      = row.values[dayCol]?.effectiveFormat?.backgroundColor ?? null;

    const parsed = parseTimeRange(timeRangeRaw);
    if (!parsed) continue;

    const activity = activityRaw.trim();

    // Categoria: cor tem prioridade, texto é fallback
    const catByColor = categoryFromColor(bgColor);
    const category   = catByColor ?? categoryFromText(activity);

    blocks.push({
      time:     parsed.time,
      minutes:  parsed.minutes,
      activity: activity || "—",
      category,
      meta:     CATEGORIES[category] ?? CATEGORIES.livre,
      duration: parsed.duration,
    });
  }

  return consolidateBlocks(blocks);
}

// Une blocos consecutivos com a mesma atividade em um único bloco
function consolidateBlocks(blocks) {
  const result = [];
  for (let i = 0; i < blocks.length; ) {
    const cur = blocks[i];

    // Avança enquanto a atividade for igual (consecutivos)
    let j = i + 1;
    while (j < blocks.length && blocks[j].activity === cur.activity) j++;

    if (cur.activity && cur.activity !== "—") {
      // Duração = do início deste bloco até o início do próximo bloco diferente
      const nextMins = blocks[j]?.minutes;
      let dur;
      if (nextMins !== undefined) {
        dur = nextMins >= cur.minutes
          ? nextMins - cur.minutes
          : nextMins + 1440 - cur.minutes; // cruza meia-noite
      } else {
        dur = blocks.slice(i, j).reduce((s, b) => s + b.duration, 0);
      }
      result.push({ ...cur, duration: Math.max(dur, 1) });
    }
    // blocos "—" são descartados (slots vazios sem atividade)

    i = j;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Funções exportadas
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * getCurrentTimeBlock(blocks, nowMinutes?)
 * Retorna o bloco atual, o próximo e o percentual de progresso no bloco.
 */
export function getCurrentTimeBlock(blocks, nowMinutes) {
  if (!blocks.length) return { current: null, next: null, progressPct: 0 };

  // Hora atual em BRT (UTC-3)
  const now  = new Date(Date.now() - 3 * 3600 * 1000);
  const mins = nowMinutes ?? (now.getUTCHours() * 60 + now.getUTCMinutes());

  // Calcula "minutos efetivos" de cada bloco: se o horário de um bloco for
  // menor que o anterior, cruzou a meia-noite → soma 1440 (offset acumulado).
  // Isso evita que "01h" (60 min) apareça como bloco atual às 16h (960 min).
  let offset  = 0;
  let prevMin = -1;
  const effective = blocks.map(b => {
    if (prevMin >= 0 && b.minutes < prevMin) offset += 1440;
    prevMin = b.minutes;
    return b.minutes + offset;
  });

  let current    = null;
  let next       = null;
  let currentEff = -1;

  for (let i = 0; i < blocks.length; i++) {
    if (effective[i] <= mins) {
      current    = blocks[i];
      currentEff = effective[i];
      next       = blocks[i + 1] ?? null;
    }
  }

  let progressPct = 0;
  if (current && current.duration > 0) {
    const elapsed = mins - currentEff;
    progressPct   = Math.min(100, Math.round((elapsed / current.duration) * 100));
  }

  return { current, next, progressPct };
}

// ─── Leitura de App_Rotina (aba editável) ────────────────────────────────────

function hhmmToMins(str) {
  const [h, m] = String(str ?? "").split(":").map(Number);
  return isNaN(h) ? -1 : h * 60 + (m || 0);
}

async function readAppRotina() {
  const sheets = await getSheetsClient();
  try {
    const res  = await sheets.spreadsheets.values.get({
      spreadsheetId: ROUTINE_SPREADSHEET_ID,
      range:         "'App_Rotina'!A2:E1000",
    });
    const rows = res.data.values ?? [];
    if (rows.length === 0) return null;

    const byDay = {};
    rows.forEach((r, i) => {
      const dia  = parseInt(r[0]);
      const ini  = hhmmToMins(r[1]);
      const fim  = hhmmToMins(r[2]);
      const act  = String(r[3] ?? "").trim();
      const cat  = String(r[4] ?? "livre").trim();
      if (isNaN(dia) || ini < 0 || !act) return;
      const dur = fim >= 0 ? (fim >= ini ? fim - ini : fim + 1440 - ini) : 60;
      if (!byDay[dia]) byDay[dia] = [];
      byDay[dia].push({
        sheetRow: i + 2,
        time:     r[1] ?? "",
        minutes:  ini,
        activity: act,
        category: cat,
        meta:     CATEGORIES[cat] ?? CATEGORIES.livre,
        duration: Math.max(dur, 1),
      });
    });
    return byDay;
  } catch {
    return null;
  }
}

/**
 * fetchDayRoutine(weekday?)
 * Tenta App_Rotina primeiro, depois fallback para a planilha mesclada.
 */
export async function fetchDayRoutine(weekday) {
  const now = new Date(Date.now() - 3 * 3600 * 1000);
  const day = weekday ?? now.getUTCDay();

  const appRotina = await readAppRotina();
  const blocks    = appRotina?.[day] ?? await (async () => {
    const dayCol = WEEKDAY_TO_COL[day] ?? 2;
    return parseMainTable(await readRoutineSheet(), dayCol);
  })();

  const sorted = [...blocks].sort((a, b) => a.minutes - b.minutes);
  const { current, next, progressPct } = getCurrentTimeBlock(sorted);

  return {
    dayName:  WEEKDAY_NAMES[day],
    dayIndex: day,
    blocks:   sorted,
    current, next, progressPct,
    specialEvents: [], todayEvents: [],
    fromAppRotina: !!appRotina,
  };
}

/**
 * fetchWeekRoutine()
 * Tenta App_Rotina primeiro, depois fallback para a planilha mesclada.
 */
export async function fetchWeekRoutine() {
  const appRotina = await readAppRotina();
  if (appRotina) {
    const week = {};
    for (let d = 0; d <= 6; d++) {
      week[d] = (appRotina[d] ?? []).sort((a, b) => a.minutes - b.minutes);
    }
    return week;
  }
  const rowData = await readRoutineSheet();
  const week    = {};
  for (const [jsDay, colIdx] of Object.entries(WEEKDAY_TO_COL)) {
    week[jsDay] = parseMainTable(rowData, colIdx);
  }
  return week;
}

/**
 * fetchSpecialAgenda()
 * Lê "App_Eventos" na planilha de rotina.
 * Colunas: A=Data(DD/MM/YYYY) | B=Evento | C=Tipo(opcional)
 */
export async function fetchSpecialAgenda() {
  try {
    const sheets = await getSheetsClient();
    const res    = await sheets.spreadsheets.values.get({
      spreadsheetId: ROUTINE_SPREADSHEET_ID,
      range:         "'App_Eventos'!A2:C500",
    });

    const rows  = res.data.values ?? [];
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const events = rows
      .filter(r => r[0]?.trim() && r[1]?.trim())
      .map((r, idx) => {
        const parts = r[0].trim().split("/").map(Number);
        if (parts.length < 2 || parts.some(isNaN)) return null;

        let date;
        if (parts.length === 3) {
          date = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
          const yr = new Date(today.getFullYear(), parts[1] - 1, parts[0]) < today
            ? today.getFullYear() + 1 : today.getFullYear();
          date = new Date(yr, parts[1] - 1, parts[0]);
        }
        date.setHours(0, 0, 0, 0);

        const daysFromNow = Math.round((date - today) / 86400000);
        const weekday     = date.toLocaleDateString("pt-BR", { weekday: "long" });
        const dateLabel   = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        const monthYear   = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

        return {
          sheetRow:    idx + 2,
          date:        date.toISOString().slice(0, 10),
          dateLabel,
          weekday,
          activity:    r[1].trim(),
          tipo:        r[2]?.trim() || null,
          daysFromNow,
          isPast:      daysFromNow < 0,
          isToday:     daysFromNow === 0,
          isTomorrow:  daysFromNow === 1,
          isThisWeek:  daysFromNow >= 0 && daysFromNow <= 6,
          monthYear,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysFromNow - b.daysFromNow);

    return events;
  } catch (e) {
    if (e.message?.includes("Unable to parse range") || String(e.code) === "400") return [];
    throw e;
  }
}
