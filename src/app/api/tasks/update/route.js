import { tdUpdate, P_TO_TD, buildDuePayload } from "@/lib/todoist";
import { PROJ } from "@/config/constants";

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Payload JSON inválido" }, { status: 400 }); }

  const { taskId, title, dueDate, time, priority, project, subClient, recurrence, description } = body;
  if (!taskId) return Response.json({ error: "taskId obrigatório" }, { status: 400 });

  try {
    const updateBody = {};

    if (title)    updateBody.content  = title.trim();

    // FIX: "" → P_TO_TD[""] = 1 → remove prioridade no Todoist
    if (priority !== undefined) {
      const p = P_TO_TD[priority];
      if (p !== undefined) updateBody.priority = p;
    }

    if (dueDate) {
      if (!recurrence || !recurrence.trim() || recurrence.trim() === "none") {
        // due_string com data simples → Todoist remove recorrência existente.
        // due_date preservaria recorrência, por isso usamos due_string aqui.
        Object.assign(updateBody, time
          ? { due_datetime: `${dueDate}T${time}:00` }
          : { due_string: dueDate }
        );
      } else {
        Object.assign(updateBody, buildDuePayload(dueDate, time, recurrence));
      }
    }

    // Envia project_id diretamente — Todoist ignora se já for o mesmo (sem round-trip extra)
    if (project) {
      const projCfg = PROJ[project];
      if (projCfg) updateBody.project_id = projCfg.id;
    }

    if (subClient !== undefined)    updateBody.section_id  = subClient || null;
    if (description !== undefined)  updateBody.description = description?.trim() ?? "";

    const updated = await tdUpdate(taskId, updateBody);
    return Response.json({ ok: true, due: updated?.due ?? null });
  } catch (e) {
    console.error("[POST /api/tasks/update]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
