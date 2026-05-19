const LS_KEY     = "dailyapp_history";
const MAX_ITEMS  = 600;
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 dias

export function historySave(task) {
  try {
    const all = _getAll();
    const record = {
      uid:               `${task.id}_${Date.now()}`,
      id:                task.id,
      name:              task.name,
      _project_id:       task._project_id       ?? "pessoal",
      _sub_client_label: task._sub_client_label ?? null,
      _section_id:       task._section_id       ?? null,
      completed_at:      Date.now(),
    };
    localStorage.setItem(LS_KEY, JSON.stringify([record, ...all].slice(0, MAX_ITEMS)));
  } catch {}
}

export function historyGet(sinceMs = null, untilMs = null) {
  return _getAll().filter(r => {
    if (!r.completed_at) return false;
    if (sinceMs !== null && r.completed_at < sinceMs) return false;
    if (untilMs !== null && r.completed_at > untilMs) return false;
    return true;
  });
}

export function historyTotal() {
  return _getAll().length;
}

function _getAll() {
  try {
    const raw  = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    const keep = Date.now() - MAX_AGE_MS;
    return Array.isArray(raw) ? raw.filter(r => (r.completed_at ?? 0) > keep) : [];
  } catch { return []; }
}
