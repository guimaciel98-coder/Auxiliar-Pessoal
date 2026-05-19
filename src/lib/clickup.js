// Mapeamento de projetos para listas do ClickUp
export const PROJ = {
  pessoal: { lists: ["901713077344"] },
  vca:     { lists: ["901713077428", "901713077458"] },
  pdv:     { lists: ["901713077406", "901713079405", "901713079451", "901713079462"] },
};

export const PDV_CF_ID = "65b449ae-65fb-4565-be6b-4e54f3fc5ade";
export const VCA_CF_ID = "a109df7e-2ee6-423c-88f0-6d6464e832e4";

// Status name usado no ClickUp para "concluída" — ajuste se necessário
export const CLOSED_STATUS = "closed";

const LIST_TO_PROJECT = {};
for (const [pid, { lists }] of Object.entries(PROJ)) {
  for (const lid of lists) LIST_TO_PROJECT[lid] = pid;
}

export const TAG_TO_REC = {
  "recorrencia:diaria":     "daily",
  "recorrencia:dias-uteis": "weekdays",
  "recorrencia:semanal":    "weekly",
  "recorrencia:mensal":     "monthly",
};

const REC_TO_TAG = {
  daily:    "recorrencia:diaria",
  weekdays: "recorrencia:dias-uteis",
  weekly:   "recorrencia:semanal",
  monthly:  "recorrencia:mensal",
};

const REC_TAG_NAMES = Object.keys(TAG_TO_REC);
const ALL_REC_TAGS  = [...REC_TAG_NAMES, "trigger:ao-concluir", "repete:sempre"];

export const PDV_CLIENTS = [
  { cfValue: 0, label: "Ponto de Vista" },
  { cfValue: 1, label: "SOS" },
  { cfValue: 2, label: "The Loft" },
  { cfValue: 3, label: "Claudia" },
];

export const VCA_BRANDS = [
  { cfValue: 0,  label: "Reuniões" },
  { cfValue: 1,  label: "Geral" },
  { cfValue: 2,  label: "Pet Care SP" },
  { cfValue: 3,  label: "Animalia" },
  { cfValue: 4,  label: "Balneário Camboriú" },
  { cfValue: 5,  label: "Vet Quality" },
  { cfValue: 6,  label: "Ariza" },
  { cfValue: 7,  label: "Dr Hato" },
  { cfValue: 8,  label: "R&K" },
  { cfValue: 9,  label: "Pet Support" },
  { cfValue: 10, label: "Onco Support" },
  { cfValue: 11, label: "São Francisco de Assis" },
];

// Prioridade: p1/p2/p3/p4 (frontend) ↔ ClickUp int 1-4 ↔ ClickUp string
const P_TO_INT = { p1: 1, p2: 2, p3: 3, p4: 4 };
const P_TO_CU  = { p1: "urgent", p2: "high", p3: "normal", p4: "low" };
const CU_TO_P  = { urgent: "p1", high: "p2", normal: "p3", low: "p4" };

export function priorityToInt(p)  { return P_TO_INT[p] ?? null; }
export function priorityToCU(p)   { return P_TO_CU[p]  ?? null; }
export function cuToP(cu)         { return CU_TO_P[cu]  ?? null; }

// ─── HTTP helpers ───────────────────────────────────────────────────────────

let _myUserId = null;
export async function cuGetMe() {
  if (_myUserId) return _myUserId;
  const data = await cuFetch("/user");
  _myUserId = data.user?.id ?? null;
  return _myUserId;
}

function apiKey() {
  const k = process.env.CLICKUP_API_KEY;
  if (!k) throw new Error("CLICKUP_API_KEY não configurada no ambiente");
  return k;
}

async function cuFetch(path, opts = {}) {
  const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
    ...opts,
    headers: {
      Authorization: apiKey(),
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`ClickUp ${res.status}: ${text}`);
  }
  if (res.status === 204) return {};
  return res.json();
}

// Busca todas as tarefas de uma lista (com paginação)
export async function cuFetchList(listId, params = {}) {
  const tasks = [];
  let page = 0;
  const p = new URLSearchParams({ include_closed: "false", ...params });
  while (true) {
    p.set("page", String(page));
    const data = await cuFetch(`/list/${listId}/task?${p}`);
    if (!data.tasks?.length) break;
    tasks.push(...data.tasks);
    if (data.last_page) break;
    page++;
  }
  return tasks;
}

export async function cuGetTask(taskId) {
  return cuFetch(`/task/${taskId}`);
}

export async function cuCreate(listId, body) {
  return cuFetch(`/list/${listId}/task`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function cuUpdate(taskId, body) {
  return cuFetch(`/task/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function cuDelete(taskId) {
  return cuFetch(`/task/${taskId}`, { method: "DELETE" });
}

export async function cuSetField(taskId, fieldId, value) {
  return cuFetch(`/task/${taskId}/field/${fieldId}`, {
    method: "POST",
    body: JSON.stringify({ value }),
  });
}

export async function cuAddTag(taskId, tagName) {
  return cuFetch(`/task/${taskId}/tag/${encodeURIComponent(tagName)}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function cuRemoveTag(taskId, tagName) {
  return cuFetch(`/task/${taskId}/tag/${encodeURIComponent(tagName)}`, {
    method: "DELETE",
  }).catch(() => {}); // ignora se a tag já não existe
}

// ─── Helpers de domínio ──────────────────────────────────────────────────────

export function getProjectFromList(listId) {
  return LIST_TO_PROJECT[String(listId)] ?? null;
}

export function getDefaultList(projectId) {
  return PROJ[projectId]?.lists[0] ?? null;
}

// Retorna as tags de recorrência a serem aplicadas na tarefa
export function recTags(recurrence, triggerOnComplete, repeatForever) {
  if (!recurrence || recurrence === "none") return [];
  const tags = [REC_TO_TAG[recurrence]].filter(Boolean);
  if (triggerOnComplete) tags.push("trigger:ao-concluir");
  if (repeatForever)     tags.push("repete:sempre");
  return tags;
}

// Remove todas as tags de recorrência de uma tarefa e aplica as novas
export async function syncRecurrenceTags(taskId, currentTagNames, recurrence, triggerOnComplete, repeatForever) {
  for (const tag of ALL_REC_TAGS) {
    if (currentTagNames.includes(tag)) await cuRemoveTag(taskId, tag);
  }
  const newTags = recTags(recurrence, triggerOnComplete, repeatForever);
  for (const tag of newTags) await cuAddTag(taskId, tag);
}

// Calcula o próximo due_date com base na recorrência
export function getNextDueDate(currentMs, recurrence) {
  const d = new Date(currentMs);
  if (recurrence === "daily") {
    d.setUTCDate(d.getUTCDate() + 1);
  } else if (recurrence === "weekdays") {
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  } else if (recurrence === "weekly") {
    d.setUTCDate(d.getUTCDate() + 7);
  } else if (recurrence === "monthly") {
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d.getTime();
}

// Converte uma tarefa do ClickUp para o shape que o front-end espera
export function toShape(task) {
  const projectId   = getProjectFromList(task.list?.id) ?? "pessoal";
  const tagNames    = task.tags?.map(t => t.name) ?? [];
  const recTag      = tagNames.find(n => TAG_TO_REC[n]);
  const recurrence  = recTag ? TAG_TO_REC[recTag] : "none";
  const triggerOnComplete = tagNames.includes("trigger:ao-concluir");
  const repeatForever     = tagNames.includes("repete:sempre");

  const cfId = projectId === "vca" ? VCA_CF_ID : projectId === "pdv" ? PDV_CF_ID : null;
  let subClientLabel = null;
  if (cfId) {
    const cf = task.custom_fields?.find(f => f.id === cfId);
    if (cf?.value != null) {
      const list = projectId === "vca" ? VCA_BRANDS : PDV_CLIENTS;
      subClientLabel = list.find(c => c.cfValue == cf.value)?.label ?? null;
    }
  }

  const cuPrio = task.priority?.priority ?? null; // "urgent" | "high" | "normal" | "low" | null

  return {
    id:            task.id,
    name:          task.name,
    due_date:      task.due_date ?? null,
    due_date_time: task.due_date_time ?? false,
    status:        task.status,
    priority:      cuPrio ? { priority: cuPrio } : null,
    list:          task.list,
    url:           task.url,
    custom_fields: task.custom_fields ?? [],
    tags:          task.tags ?? [],
    // campos nativos — lidos diretamente pelo front sem parsear tags
    _recurrence:          recurrence,
    _priority:            cuPrio ? (CU_TO_P[cuPrio] ?? null) : null, // "p1" | "p2" | "p3" | "p4"
    _project_id:          projectId,
    _trigger_on_complete: triggerOnComplete,
    _repeat_forever:      repeatForever,
    _sub_client_label:    subClientLabel,
  };
}

// Busca todas as listas de todos os projetos
export async function fetchAllProjectTasks(params = {}) {
  const tasks = [];
  for (const { lists } of Object.values(PROJ)) {
    for (const listId of lists) {
      try {
        const lt = await cuFetchList(listId, params);
        tasks.push(...lt);
      } catch (e) {
        console.error(`[clickup] erro ao buscar lista ${listId}:`, e.message);
      }
    }
  }
  return tasks;
}
