import { fetchFinancialData } from "@/lib/financeService";

export const dynamic = "force-dynamic";

/**
 * GET /api/finance
 *
 * Retorna dashboard financeiro completo.
 * Lê exclusivamente das abas App_* na planilha.
 *
 * Response shape:
 * {
 *   ok: true,
 *   summary:      { ganhoCLT, ganhoTudo, gastosBudget, gastosReal, saldoCLT, saldoTudo },
 *   ganhos:       { clt, pdv, emprestimos, total, items: { clt[], pdv[], emprestimos[] } },
 *   gastos:       { budget, real, fixos: { items[], previsaoTotal, realTotal },
 *                   variaveis: { items[], previsaoTotal, realTotal } },
 *   poupanca:     { realidade, meta, progresso, historico[], currentMilestone },
 *   compromissos: { items[], totalRestante }
 * }
 */
export async function GET() {
  try {
    const data = await fetchFinancialData();
    return Response.json({ ok: true, ...data });
  } catch (e) {
    console.error("[GET /api/finance]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
