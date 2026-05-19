import { PROJ, PRIO_MAP } from "../config/constants";

export function brt(ts) { 
  return new Date(Number(ts) - 3*3600*1000); 
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
  const o = { priority:0, timed:1, rest:2 };
  return [...arr].sort((a,b) => {
    if (o[a.group] !== o[b.group]) return o[a.group] - o[b.group];
    if (a.group === "priority" && a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    if (a.group === "timed") return a.ts - b.ts;
    return 0;
  });
}
