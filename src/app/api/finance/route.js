import { fetchFinancialData } from "@/lib/financeService";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

// Cache server-side por 90s — evita estourar a cota de leituras do Sheets (60 req/min)
const getCachedFinancialData = unstable_cache(
  fetchFinancialData,
  ["finance-data"],
  { revalidate: 90 }
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const bust = searchParams.get("bust"); // ?bust=1 força leitura fresca
    const data = bust ? await fetchFinancialData() : await getCachedFinancialData();
    return Response.json({ ok: true, ...data });
  } catch (e) {
    console.error("[GET /api/finance]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
