import { tdDelete } from "@/lib/todoist";

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Payload JSON inválido" }, { status: 400 }); }

  const { taskId } = body;
  if (!taskId) return Response.json({ error: "taskId obrigatório" }, { status: 400 });

  try {
    await tdDelete(taskId);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/tasks/delete]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
