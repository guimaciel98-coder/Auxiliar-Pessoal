import { tdUpdate } from "@/lib/todoist";

// Mapeamento do tipo de recorrência → string em inglês aceita pelo Todoist NLP.
// Usamos inglês porque a API rejeita strings mistas (PT + "starting" em EN).
const REC_EN = {
  daily:     "every day",
  weekdays:  "every weekday",
  weekly:    "every week",
  biweekly:  "every 2 weeks",
  monthly:   "every month",
  yearly:    "every year",
  recurring: "every week",  // fallback genérico
};

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Payload JSON inválido" }, { status: 400 }); }

  const { taskId, dueDate, timed, isRecurring, recurrence } = body;
  if (!taskId || !dueDate) return Response.json({ error: "taskId e dueDate obrigatórios" }, { status: 400 });

  try {
    const ms  = Number(dueDate);
    const brt = new Date(ms - 3 * 3600 * 1000);
    const pad = n => String(n).padStart(2, "0");

    const dateStr = `${brt.getUTCFullYear()}-${pad(brt.getUTCMonth() + 1)}-${pad(brt.getUTCDate())}`;
    const timeStr = `${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}`;

    let payload;
    if (isRecurring && recurrence && recurrence !== "none") {
      // Reconstrói a due_string em inglês + data → preserva recorrência no Todoist.
      const recStr   = REC_EN[recurrence] ?? "every week";
      const timePart = timed ? ` at ${timeStr}` : "";
      payload = { due_string: `${recStr} starting ${dateStr}${timePart}` };
    } else if (timed) {
      payload = { due_datetime: `${dateStr}T${timeStr}:00` };
    } else {
      payload = { due_date: dateStr };
    }

    await tdUpdate(taskId, payload);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[reschedule] ERRO taskId=%s message=%s", taskId, e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
