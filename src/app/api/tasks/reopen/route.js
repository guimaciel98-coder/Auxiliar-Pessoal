import { reopenTask } from "@/lib/todoist";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { taskId } = await req.json();
    if (!taskId) return Response.json({ ok: false, error: "taskId obrigatório" }, { status: 400 });
    await reopenTask(taskId);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/tasks/reopen]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
