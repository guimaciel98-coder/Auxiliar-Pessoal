import { fetchCompletionEventsSince } from "@/lib/todoist";
import { PROJ } from "@/config/constants";

export const dynamic = "force-dynamic";
const NO_CACHE = { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } };

const KNOWN_PROJECT_IDS = new Set(
  Object.values(PROJ).flatMap(cfg => [cfg.id, ...(cfg.extraIds ?? [])])
);

/**
 * GET /api/tasks/completed-today
 * Tarefas concluídas hoje (dia BRT), direto do histórico do Todoist — fonte real,
 * independente do navegador/dispositivo em que foram marcadas, e incluindo
 * as recorrentes.
 * Response: { ok, ids: string[], items: [{ id, name, completed_at, recurring }] }
 */
export async function GET() {
  try {
    const nowBRT     = new Date(Date.now() - 3 * 3600 * 1000);
    const todayStart = Date.UTC(nowBRT.getUTCFullYear(), nowBRT.getUTCMonth(), nowBRT.getUTCDate(), 3, 0, 0);

    const events = await fetchCompletionEventsSince(todayStart);
    const byId = new Map();
    for (const e of events) {
      if (!KNOWN_PROJECT_IDS.has(e.parent_project_id)) continue;
      const id = String(e.object_id);
      if (byId.has(id)) continue;
      byId.set(id, {
        id,
        name:         String(e.extra_data?.content ?? "").replace(/\*\*/g, ""),
        completed_at: e.event_date,
        recurring:    !!e.extra_data?.is_recurring,
      });
    }
    const items = [...byId.values()];
    return Response.json({ ok: true, ids: items.map(i => i.id), items }, NO_CACHE);
  } catch (e) {
    console.error("[GET /api/tasks/completed-today]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500, ...NO_CACHE });
  }
}
