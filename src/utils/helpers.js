import { PROJ, PRIO_MAP } from "../config/constants";

export function brt(ts) {
  return new Date(Number(ts) - 3*3600*1000);
}

// Retorna o timestamp UTC do início do dia em BRT (meia-noite BRT = 3h UTC).
// SEMPRE use esta função para calcular "hoje" — nunca use new Date().getDate()
// diretamente, pois entre 0h-3h UTC o getUTCDate() já retorna o dia seguinte
// enquanto o BRT ainda está no dia anterior.
export function startOfBRT(offsetDays = 0) {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays, 3, 0, 0);
}

export function toHM(ts) { 
  const d = brt(ts); 
  return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`; 
}

export function getProj(projectId) {
  const s = String(projectId);
  for (const [k, v] of Object.entries(PROJ)) {
    if (v.id === s) return k;
    if ((v.extraIds ?? []).includes(s)) return k;
  }
  return null;
}

export function isRealTime(ts) {
  const d = new Date(Number(ts) - 3*3600*1000);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (m !== 0) return true;
  return h !== 0 && h !== 1 && h !== 4;
}

export function getHeat(ts, now) {
  const diff = ts - now;
  if (diff < -60000)   return "past";
  if (diff < 1800000)  return "hot";
  if (diff < 3600000)  return "warm";
  if (diff < 10800000) return "soon";
  return null;
}

export function getPdvClient(t) {
  return t._section_id ?? null;
}

export function getVcaBrand(t) {
  return t._section_id ?? null;
}


export function classify(t) {
  const proj = t._project_id ?? getProj(t.list?.id || t.list);
  const ts = Number(t.due_date);
  const timed = isRealTime(ts);
  const prioRaw = t.priority?.priority || (typeof t.priority === "string" ? t.priority : null);
  const prio = PRIO_MAP[prioRaw] || null;
  const urgent = prio === "p1";
  const high   = prio === "p2";
  const group = (urgent || high) ? "priority" : timed ? "timed" : "rest";
  return { ...t, proj, ts, timed, urgent, high, prio, group, hm: timed ? toHM(ts) : null };
}

export function getNextDueDate(ts, recurrence) {
  const d = new Date(Number(ts));
  if (recurrence === "daily") {
    d.setUTCDate(d.getUTCDate() + 1);
  } else if (recurrence === "weekdays") {
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  } else if (recurrence === "weekly" || recurrence === "recurring") {
    d.setUTCDate(d.getUTCDate() + 7);
  } else if (recurrence === "biweekly") {
    d.setUTCDate(d.getUTCDate() + 14);
  } else if (recurrence === "monthly") {
    d.setUTCMonth(d.getUTCMonth() + 1);
  } else if (recurrence === "yearly") {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
  }
  return d.getTime();
}

export function sortTasks(arr) {
  // Ordem explícita P1→P2→P3→P4. Suporta tanto o campo `prio` (de classify)
  // quanto `_priority` (de toShape), garantindo consistência em todas as visões.
  const P = { p1: 0, p2: 1, p3: 2, p4: 3 };
  return [...arr].sort((a, b) => {
    const pa = P[a.prio ?? a._priority] ?? 3;
    const pb = P[b.prio ?? b._priority] ?? 3;
    if (pa !== pb) return pa - pb;
    // Mesmo nível de prioridade: tasks com horário definido primeiro
    if (a.timed !== b.timed) return a.timed ? -1 : 1;
    // Depois por timestamp (due_date ou ts)
    const tsA = Number(a.ts || a.due_date || 0);
    const tsB = Number(b.ts || b.due_date || 0);
    if (tsA && tsB) return tsA - tsB;
    return 0;
  });
}
