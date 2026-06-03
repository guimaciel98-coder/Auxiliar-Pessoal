import { tdCreate, tdGetMe, P_TO_TD, buildDuePayload } from "@/lib/todoist";
import { PROJ } from "@/config/constants";

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Payload JSON inválido" }, { status: 400 }); }

  const { title, project, subClient, vcaProjectId, dueDate, time, priority, recurrence, description } = body;

  if (!title?.trim()) return Response.json({ error: "title obrigatório" }, { status: 400 });
  if (!project)       return Response.json({ error: "project obrigatório" }, { status: 400 });
  if (!dueDate)       return Response.json({ error: "dueDate obrigatório" }, { status: 400 });

  const projCfg = PROJ[project];
  if (!projCfg) return Response.json({ error: `Projeto inválido: "${project}"` }, { status: 400 });

  const userId = await tdGetMe().catch(() => null);

  const payload = {
    content:     title.trim(),
    project_id:  vcaProjectId || projCfg.id,
    priority:    P_TO_TD[priority] ?? 1,
    description: description?.trim() ?? "",
    ...buildDuePayload(dueDate, time, recurrence),
  };

  if (subClient)  payload.section_id   = subClient;
  if (userId)     payload.assignee_id  = userId;

  try {
    const task = await tdCreate(payload);
    return Response.json({ ok: true, taskId: task.id, due: task.due ?? null }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tasks/create]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
