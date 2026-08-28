import { tdUpdate, tdGetTask } from "@/lib/todoist";

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Payload JSON inválido" }, { status: 400 }); }

  const { taskId, dueDate, timed } = body;
  if (!taskId || !dueDate) return Response.json({ error: "taskId e dueDate obrigatórios" }, { status: 400 });

  try {
    const ms  = Number(dueDate);
    const brt = new Date(ms - 3 * 3600 * 1000);
    const pad = n => String(n).padStart(2, "0");

    const dateStr = `${brt.getUTCFullYear()}-${pad(brt.getUTCMonth() + 1)}-${pad(brt.getUTCDate())}`;
    const timeStr = `${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}`;

    // Busca o estado atual para preservar recorrência
    let origRecStr = null;
    try {
      const current = await tdGetTask(taskId);
      if (current?.due?.is_recurring) origRecStr = current.due.string;
    } catch {}

    const payload = timed
      ? { due_datetime: `${dateStr}T${timeStr}:00` }
      : { due_date: dateStr };

    // Se recorrente, reenvia due_string para garantir que o padrão é preservado
    if (origRecStr) payload.due_string = origRecStr;

    const updated = await tdUpdate(taskId, payload);

    // Fallback: se mesmo assim a recorrência caiu, restaura com due_string
    if (origRecStr && updated?.due && !updated.due.is_recurring) {
      console.warn("[reschedule] recorrência perdida — restaurando:", origRecStr);
      await tdUpdate(taskId, { due_string: origRecStr });
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[reschedule] ERRO taskId=%s message=%s", taskId, e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
