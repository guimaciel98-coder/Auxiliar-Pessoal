import { fetchCompletedBetween } from "@/lib/todoist";
import { PROJ } from "@/config/constants";

export const dynamic = "force-dynamic";
const NO_CACHE = { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } };

const KNOWN_PROJECT_IDS = new Set(
  Object.values(PROJ).flatMap(cfg => [cfg.id, ...(cfg.extraIds ?? [])])
);

/**
 * GET /api/tasks/completed-today
 * Tarefas concluídas hoje (dia BRT), direto do Todoist — fonte real,
 * independente do navegador/dispositivo em que foram marcadas.
 * Response: { ok, ids: string[], items: [{ id, name, completed_at }] }
 */
export async function GET() {
  try {
    const nowBRT     = new Date(Date.now() - 3 * 3600 * 1000);
    const todayStart = new Date(Date.UTC(nowBRT.getUTCFullYear(), nowBRT.getUTCMonth(), nowBRT.getUTCDate(), 3, 0, 0));
    const until      = new Date(Date.now() + 60 * 1000);

    const raw = await fetchCompletedBetween(todayStart.toISOString(), until.toISOString());
    const items = raw
      .filter(t => KNOWN_PROJECT_IDS.has(t.project_id) && !t.is_deleted)
      .map(t => ({ id: String(t.id), name: String(t.content ?? "").replace(/\*\*/g, ""), completed_at: t.completed_at }));

    const ids = [...new Set(items.map(i => i.id))];
    return Response.json({ ok: true, ids, items }, NO_CACHE);
  } catch (e) {
    console.error("[GET /api/tasks/completed-today]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500, ...NO_CACHE });
  }
}
