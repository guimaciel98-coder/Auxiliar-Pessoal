import { tdUpdate, tdGetTask, P_TO_TD, buildDuePayload } from "@/lib/todoist";
import { PROJ } from "@/config/constants";

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Payload JSON inválido" }, { status: 400 }); }

  const { taskId, title, dueDate, time, priority, project, subClient, recurrence, description, recurrenceModified } = body;
  if (!taskId) return Response.json({ error: "taskId obrigatório" }, { status: 400 });

  try {
    const updateBody = {};

    if (title)    updateBody.content  = title.trim();

    if (priority !== undefined) {
      const p = P_TO_TD[priority];
      if (p !== undefined) updateBody.priority = p;
    }

    if (dueDate) {
      if (!recurrenceModified) {
        // Busca o estado atual da task para detectar recorrência
        let origRecStr = null;
        try {
          const current = await tdGetTask(taskId);
          if (current?.due?.is_recurring) origRecStr = current.due.string;
        } catch {}

        const duePart = time
          ? { due_datetime: `${dueDate}T${time}:00` }
          : { due_date: dueDate };

        if (origRecStr) {
          // Task recorrente: envia due_string (preserva recorrência) +
          // due_date (tenta mover a data). Se a API ignorar due_date,
          // a data será a próxima ocorrência natural — mas recorrência fica salva.
          Object.assign(updateBody, duePart, { due_string: origRecStr });
        } else {
          Object.assign(updateBody, duePart);
        }
      } else if (!recurrence || !recurrence.trim() || recurrence.trim() === "none") {
        // Usuário explicitamente apagou → due_string com data remove a recorrência.
        Object.assign(updateBody, time
          ? { due_datetime: `${dueDate}T${time}:00` }
          : { due_string: dueDate }
        );
      } else {
        // Usuário definiu/alterou o padrão → traduz PT→EN e envia como due_string.
        Object.assign(updateBody, buildDuePayload(dueDate, time, recurrence));
      }
    }

    if (project) {
      const projCfg = PROJ[project];
      if (projCfg) updateBody.project_id = projCfg.id;
    }

    if (subClient !== undefined)    updateBody.section_id  = subClient || null;
    if (description !== undefined)  updateBody.description = description?.trim() ?? "";

    // Atualização principal
    const updated = await tdUpdate(taskId, updateBody);

    // Se a task era recorrente e perdeu a recorrência, restaura com due_string
    if (dueDate && !recurrenceModified) {
      let origRecStr = null;
      try {
        // Lê novamente o updateBody que foi enviado (contém due_string se era recorrente)
        origRecStr = updateBody.due_string ?? null;
      } catch {}

      if (origRecStr && updated?.due && !updated.due.is_recurring) {
        console.warn("[update] recorrência perdida — restaurando:", origRecStr);
        const restored = await tdUpdate(taskId, { due_string: origRecStr });
        return Response.json({ ok: true, due: restored?.due ?? null });
      }
    }

    return Response.json({ ok: true, due: updated?.due ?? null });
  } catch (e) {
    console.error("[POST /api/tasks/update]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
