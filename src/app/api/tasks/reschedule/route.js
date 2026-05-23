import { tdUpdate } from "@/lib/todoist";

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

    // Usa due_date ou due_datetime — o Todoist preserva o padrão de recorrência
    // automaticamente ao receber esses campos, sem precisar reconstruir due_string.
    // Reconstruir due_string a partir do tipo simplificado (weekly, monthly…) é
    // destrutivo: perde "every 3 months", "every Monday", e padrões não mapeados.
    const payload = timed
      ? { due_datetime: `${dateStr}T${timeStr}:00` }
      : { due_date: dateStr };

    await tdUpdate(taskId, payload);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[reschedule] ERRO taskId=%s message=%s", taskId, e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
