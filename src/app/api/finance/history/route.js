import { fetchDailyHistory } from "@/lib/financeService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const history = await fetchDailyHistory();
    return Response.json({ ok: true, history });
  } catch (e) {
    console.error("[GET /api/finance/history]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
