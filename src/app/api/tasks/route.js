import { fetchAllProjectTasks, fetchTasksByFilter, fetchProjectSections, toShape } from "@/lib/todoist";
import { PROJ } from "@/config/constants";

export const dynamic = "force-dynamic";
const NO_CACHE = { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } };

// Cache de seções — TTL 10 min (seções mudam raramente, não vale chamar toda vez)
const _sectionsCache = { map: {}, ts: 0 };
const SECTIONS_TTL = 10 * 60 * 1000;

async function getSectionMap() {
  if (Date.now() - _sectionsCache.ts < SECTIONS_TTL) return _sectionsCache.map;
  const allIds = Object.values(PROJ).flatMap(cfg => [cfg.id, ...(cfg.extraIds ?? [])]);
  const arrays = await Promise.all(allIds.map(id => fetchProjectSections(id).catch(() => [])));
  const map = {};
  for (const secs of arrays) for (const s of secs) map[s.id] = s.name;
  _sectionsCache.map = map;
  _sectionsCache.ts  = Date.now();
  return map;
}

function startOfDayBRT(offsetDays = 0) {
  const now = new Date(Date.now() - 3 * 3600 * 1000);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays, 3, 0, 0);
}

const KNOWN_PROJECT_IDS = new Set(
  Object.values(PROJ).flatMap(cfg => [cfg.id, ...(cfg.extraIds ?? [])])
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "today";

  const todayStart    = startOfDayBRT(0);
  const tomorrowStart = startOfDayBRT(1);
  const weekEnd       = startOfDayBRT(8);
  const epoch2020     = Date.UTC(2020, 0, 1, 3, 0, 0);

  try {
    // ── Modos TODAY e TOMORROW: filtro nativo do Todoist ─────────────────────
    // O filtro reflete conclusões externas imediatamente.
    // O `completed` React state (client-side) protege contra lag de reagendamento.
    if (mode === "today") {
      const [todayRaw, secMap] = await Promise.all([
        fetchTasksByFilter("today | overdue"),
        getSectionMap(),
      ]);
      const open = todayRaw.filter(t =>
        !t.checked && !t.is_deleted && KNOWN_PROJECT_IDS.has(t.project_id)
      );
      const todayTasks = open.map(t => toShape(t, secMap)).filter(t => {
        const dd = Number(t.due_date);
        return dd >= epoch2020 && dd < tomorrowStart;
      });
      todayTasks.sort((a, b) => Number(a.due_date) - Number(b.due_date));
      return Response.json({ tasks: todayTasks, overdue: [] }, NO_CACHE);
    }

    if (mode === "tomorrow") {
      const [rawTmr, tmrSecMap] = await Promise.all([
        fetchTasksByFilter("tomorrow"),
        getSectionMap(),
      ]);

      const endOfTomorrow = tomorrowStart + 86400000;
      const openTmr = rawTmr.filter(t =>
        !t.checked && !t.is_deleted && KNOWN_PROJECT_IDS.has(t.project_id)
      );
      const sorted = openTmr
        .map(t => toShape(t, tmrSecMap))
        .filter(t => {
          const dd = Number(t.due_date);
          return dd >= tomorrowStart && dd < endOfTomorrow;
        })
        .sort((a, b) => Number(a.due_date) - Number(b.due_date));
      return Response.json({ tasks: sorted, overdue: [] }, NO_CACHE);
    }

    // ── Demais modos: busca por projeto + cache de seções ──────────────────────
    const [raw, sectionMap] = await Promise.all([
      fetchAllProjectTasks(),
      getSectionMap(),
    ]);

    const open = raw.filter(t => !t.is_completed && !t.checked && !t.is_deleted);

    if (mode === "recurrences") {
      const rec = open
        .filter(t => t.due?.is_recurring === true)
        .map(t => toShape(t, sectionMap))
        .sort((a, b) => Number(a.due_date) - Number(b.due_date));
      return Response.json({ tasks: rec }, NO_CACHE);
    }

    if (mode === "all") {
      const sorted = open.map(t => toShape(t, sectionMap)).sort((a, b) => Number(a.due_date) - Number(b.due_date));
      return Response.json({ tasks: sorted }, NO_CACHE);
    }

    if (mode === "week") {
      const filtered = open.map(toShape)
        .filter(t => { const dd = Number(t.due_date); return dd >= tomorrowStart && dd < weekEnd; })
        .sort((a, b) => Number(a.due_date) - Number(b.due_date));
      return Response.json({ tasks: filtered, overdue: [] }, NO_CACHE);
    }

    // ── today (default) ───────────────────────────────────────────────────────
    // O Todoist não separa "vencido" de "hoje" — tudo aparece na mesma lista.
    // Incluímos todas as tarefas de epoch2020 até amanhã (hoje + anteriores).
    // Tarefas mais antigas ficam no topo por ordenação crescente de data.
    const todayTasks = open.map(t => toShape(t, sectionMap)).filter(t => {
      const dd = Number(t.due_date);
      return dd >= epoch2020 && dd < tomorrowStart;
    });
    todayTasks.sort((a, b) => Number(a.due_date) - Number(b.due_date));
    return Response.json({ tasks: todayTasks, overdue: [] }, NO_CACHE);

  } catch (e) {
    console.error("[GET /api/tasks]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
