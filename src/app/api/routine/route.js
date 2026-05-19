import { fetchDayRoutine, fetchSpecialAgenda, fetchWeekRoutine } from "@/lib/routineService";

export const dynamic = "force-dynamic";

/**
 * GET /api/routine               → rotina de hoje
 * GET /api/routine?day=N         → 0=Dom … 6=Sáb
 * GET /api/routine?week=1        → todos os 7 dias
 * GET /api/routine?agenda=1      → só agenda especial
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("agenda") === "1") {
    try {
      const events = await fetchSpecialAgenda();
      return Response.json({ ok: true, events });
    } catch (e) {
      return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  if (searchParams.get("week") === "1") {
    try {
      const week = await fetchWeekRoutine();
      return Response.json({ ok: true, week });
    } catch (e) {
      console.error("[GET /api/routine?week=1]", e.message);
      return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  const dayParam = searchParams.get("day");
  const weekday  = dayParam !== null ? parseInt(dayParam) : undefined;

  if (weekday !== undefined && (isNaN(weekday) || weekday < 0 || weekday > 6)) {
    return Response.json(
      { ok: false, error: "Parâmetro 'day' deve ser 0 (Dom) a 6 (Sáb)" },
      { status: 400 }
    );
  }

  try {
    const data = await fetchDayRoutine(weekday);
    return Response.json({ ok: true, ...data });
  } catch (e) {
    console.error("[GET /api/routine]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
