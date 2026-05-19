import { fetchFutureCommitments } from "@/lib/financeService";

export const dynamic = "force-dynamic";

/**
 * GET /api/finance/commitments
 *
 * Retorna a seção "Compromissos Futuros" da planilha:
 * parcelamentos em andamento com valor mensal e total restante.
 *
 * Response:
 * {
 *   ok: true,
 *   items: [
 *     { descricao: "Computador - Aldo", prazo: "Fevereiro/27", valorMensal: 656, totalRestante: 6560 },
 *     { descricao: "Capacete",          prazo: "Setembro/26",  valorMensal: 127, totalRestante: 635  },
 *     ...
 *   ],
 *   totalRestante: 9342
 * }
 */
export async function GET() {
  try {
    const data = await fetchFutureCommitments();
    return Response.json({ ok: true, ...data });
  } catch (e) {
    console.error("[GET /api/finance/commitments]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
