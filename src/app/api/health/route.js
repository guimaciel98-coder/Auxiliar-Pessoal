import { fetchHealthData } from "@/lib/healthService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchHealthData();
    return Response.json({ ok: true, ...data });
  } catch (e) {
    console.error("[GET /api/health]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
