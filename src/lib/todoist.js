import { PROJ, VCA_SECTIONS, PDV_SECTIONS } from "@/config/constants";

// ─── Mapeamento projeto_id → chave interna ───────────────────────────────────

const PROJECT_MAP = {};
for (const [key, cfg] of Object.entries(PROJ)) {
  PROJECT_MAP[cfg.id] = key;
  for (const id of cfg.extraIds ?? []) PROJECT_MAP[id] = key;
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function apiKey() {
  const k = process.env.TODOIST_API_KEY;
  if (!k) throw new Error("TODOIST_API_KEY não configurada no ambiente");
  return k;
}

async function tdFetch(path, opts = {}) {
  const res = await fetch(`https://api.todoist.com/api/v1${path}`, {
    ...opts,
    cache: "no-store", // impede cache do Next.js nas chamadas ao Todoist
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Todoist ${res.status}: ${text}`);
  }
  if (res.status === 204) return {};
  return res.json();
}

// Busca com paginação e proteção contra loop infinito
async function tdFetchAll(path, params = {}) {
  const items = [];
  let cursor = null;
  let page = 0;
  do {
    const p = new URLSearchParams({ limit: "200", ...params });
    if (cursor) p.set("cursor", cursor);
    const data = await tdFetch(`${path}?${p}`);
    items.push(...(data.results ?? []));
    cursor = data.next_cursor ?? null;
    page++;
  } while (cursor && page < 20); // max 4000 tarefas por projeto
  return items;
}

// ─── Usuário atual ────────────────────────────────────────────────────────────

let _myUserId = null;
export async function tdGetMe() {
  if (_myUserId) return _myUserId;
  const data = await tdFetch("/user");
  _myUserId = data.id ?? null;
  return _myUserId;
}

// ─── CRUD de tarefas ──────────────────────────────────────────────────────────

export async function tdGetTask(id) {
  return tdFetch(`/tasks/${id}`);
}

export async function tdCreate(body) {
  return tdFetch("/tasks", { method: "POST", body: JSON.stringify(body) });
}

export async function tdUpdate(id, body) {
  return tdFetch(`/tasks/${id}`, { method: "POST", body: JSON.stringify(body) });
}

export async function tdDelete(id) {
  return tdFetch(`/tasks/${id}`, { method: "DELETE" });
}

export async function tdComplete(id) {
  return tdFetch(`/tasks/${id}/close`, { method: "POST", body: JSON.stringify({}) });
}

// ─── Busca via filtro NLP do Todoist (replica exatamente o que o app mostra) ──

export async function fetchTasksByFilter(filterStr) {
  return tdFetchAll("/tasks", { filter: filterStr });
}

// ─── Seções de um projeto ─────────────────────────────────────────────────────

export async function fetchProjectSections(projectId) {
  return tdFetchAll("/sections", { project_id: projectId });
}

// ─── Busca de tarefas abertas (REST API) ─────────────────────────────────────

export async function fetchAllProjectTasks(params = {}) {
  const allProjectIds = Object.values(PROJ).flatMap(cfg => [cfg.id, ...(cfg.extraIds ?? [])]);

  const results = await Promise.all(
    allProjectIds.map(projectId =>
      // Sem is_completed na query: o Todoist REST retorna apenas tasks ativas por padrão.
      // Passar is_completed="false" (string) pode ser interpretado como truthy e retornar
      // tasks concluídas em vez de filtrá-las.
      tdFetchAll("/tasks", { project_id: projectId, ...params }).catch(e => {
        console.error(`[todoist] erro projeto ${projectId}:`, e.message);
        return [];
      })
    )
  );

  return results.flat();
}

// ─── Mapeamento de prioridade ─────────────────────────────────────────────────

const TD_TO_CU = { 4: "urgent", 3: "high", 2: "normal" };
const TD_TO_P  = { 4: "p1", 3: "p2", 2: "p3", 1: null };
export const P_TO_TD = { p1: 4, p2: 3, p3: 2, p4: 1, "": 1 }; // FIX: "" → 1 remove prioridade

// ─── Parsing de data ──────────────────────────────────────────────────────────

function parseDue(due) {
  if (!due?.date) return { ms: null, hasTime: false };
  const s = due.date;
  // Tem horário se contém "T" e não é meia-noite (T00:00 ou T03:00 = sem horário real)
  if (s.includes("T") && !/T0[0-3]:00(:00)?/.test(s)) {
    const [date, time] = s.split("T");
    const [y, m, d] = date.split("-").map(Number);
    const [h, min]  = time.split(":").map(Number);
    return { ms: Date.UTC(y, m - 1, d, h + 3, min, 0), hasTime: true };
  }
  const [y, m, d] = s.split("T")[0].split("-").map(Number);
  return { ms: Date.UTC(y, m - 1, d, 3, 0, 0), hasTime: false };
}

// ─── Parsing de recorrência ───────────────────────────────────────────────────

// Nomes de dias da semana em inglês e português (para detectar "every Monday" etc.)
const _WEEKDAY_RE = "monday|tuesday|wednesday|thursday|friday|saturday|sunday|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo";

// Tabela ordenada: mais específico primeiro (a ordem importa)
const _REC_PATTERNS = [
  // Anual — "every year", "every 2 years", "todo ano", "anualmente"
  [/every\s+year|every\s+\d+\s+years?|anualmente|todo\s+ano/, "yearly"],

  // Mensal — "every month", "every 3 months", "todo mês", "mensal"
  [/every\s+month|every\s+\d+\s+months?|mensal|todo\s+m[eê]s/, "monthly"],

  // Quinzenal — especificamente 14 dias, 2 semanas ou "every other week"
  // DEVE vir antes do bloco semanal para capturar "every 2 weeks"
  [/every\s+14\s+days?|every\s+2\s+weeks?|every\s+other\s+week|quinzenal|14\s+dias/, "biweekly"],

  // Semanal — "every week", "every N weeks", "every Monday", "toda semana", "7 dias"
  [new RegExp(
    `every\\s+week|every\\s+\\d+\\s+weeks?|toda\\s+semana|semanal|` +
    `every\\s+7\\s+days?|7\\s+dias|every\\s+(${_WEEKDAY_RE})`
  ), "weekly"],

  // Dias úteis — "every weekday", "every working day", "dias úteis"
  [/every\s+weekday|every\s+working\s+day|dias?\s+[úu]tei[s]?/, "weekdays"],

  // Diário — "every day", "every N days", "todo dia", "every other day"
  // "every 14 days" já foi capturado acima como biweekly
  [/every\s+day|every\s+\d+\s+days?|every\s+other\s+day|todo\s+dia|di[aá]rio|diariamente/, "daily"],
];

function parseRecurrence(dueString) {
  if (!dueString) return "recurring"; // sem string → fallback genérico, não "weekly"
  const s = dueString.toLowerCase();
  for (const [re, val] of _REC_PATTERNS) {
    if (re.test(s)) return val;
  }
  return "recurring"; // padrão não reconhecido → genérico
}

// ─── toShape: converte tarefa Todoist → shape do front-end ───────────────────

export function toShape(task, sectionMap = null) {
  const projKey = PROJECT_MAP[task.project_id] ?? "pessoal";
  const sId     = task.section_id ?? null;

  let subClientLabel = null;
  if (sId) {
    if (sectionMap) {
      subClientLabel = sectionMap[sId] ?? null;
    } else {
      subClientLabel = (projKey === "vca" ? VCA_SECTIONS : PDV_SECTIONS)[sId] ?? null;
    }
  }

  const { ms, hasTime } = parseDue(task.due);
  const cuPrio = TD_TO_CU[task.priority] ?? null;
  const pStr   = TD_TO_P[task.priority]  ?? null;
  const rec    = task.due?.is_recurring ? parseRecurrence(task.due?.string) : "none";

  return {
    id:            task.id,
    name:          task.content.replace(/\*\*/g, ""),
    due_date:      ms ? String(ms) : null,
    due_date_time: hasTime,
    status:        { type: "open", status: "open" },
    priority:      cuPrio ? { priority: cuPrio } : null,
    list:          { id: task.project_id, name: projKey },
    url:           `https://app.todoist.com/app/task/${task.id}`,
    custom_fields: [],
    tags:          [],
    _recurrence:        rec,
    _recurrence_string: task.due?.string ?? null, // string original do Todoist, ex: "every 3 months"
    _priority:            pStr,
    _project_id:          projKey,
    _trigger_on_complete: false,
    _repeat_forever:      task.due?.is_recurring ?? false,
    _sub_client_label:    subClientLabel,
    _section_id:          sId,
  };
}

// ─── Helpers para criação de tarefa ──────────────────────────────────────────

const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const REC_MAP = {
  daily:     "every day",
  weekdays:  "every weekday",
  weekly:    "every week",
  biweekly:  "every 2 weeks",
  monthly:   "every month",
  yearly:    "every year",
  recurring: "every week", // fallback genérico — melhor que "every day"
};

export function buildDuePayload(dueDate, time, recurrence) {
  const [y, m, d] = dueDate.split("-").map(Number);

  if (recurrence && recurrence !== "none") {
    const recStr  = REC_MAP[recurrence] ?? "every week";
    const dateStr = `${EN_MONTHS[m - 1]} ${d} ${y}`;
    const timeStr = time ? ` at ${time}` : "";
    return { due_string: `${recStr}${timeStr} starting ${dateStr}` };
  }

  if (time) return { due_datetime: `${dueDate}T${time}:00` };
  return { due_date: dueDate };
}
