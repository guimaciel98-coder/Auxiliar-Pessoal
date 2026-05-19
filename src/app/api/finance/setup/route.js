import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

/**
 * GET /api/finance/setup
 * Cria a aba App_Config (se não existir) e preenche ciclo_inicio + melhor_dia_compra.
 * Endpoint de uso único — pode ser chamado várias vezes sem efeito colateral.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const melhorDia      = parseInt(searchParams.get("melhor_dia") ?? "26");
    const cicloOverride  = searchParams.get("ciclo_inicio") ?? null; // ex: "23/04/2026"

    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // 1. Verifica se App_Config já existe; cria se não existir
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const exists = spreadsheet.data.sheets?.some(s => s.properties?.title === "App_Config");

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: "App_Config" } } }] },
      });
    }

    // 2. Calcula ciclo_inicio: se hoje < melhorDia → ciclo começou no mês anterior
    const now    = new Date();
    const today  = now.getDate();
    const cicloMes  = today < melhorDia ? now.getMonth() : now.getMonth() + 1; // getMonth() é 0-based
    const cicloAno  = (cicloMes === 0 && today < melhorDia)
      ? now.getFullYear() - 1
      : now.getFullYear();
    // Converte para mês 1-based
    const mesFinal = today < melhorDia ? now.getMonth() : now.getMonth() + 1;
    const anoFinal = (mesFinal === 0) ? now.getFullYear() - 1 : now.getFullYear();
    const mesFinalAdj = mesFinal === 0 ? 12 : mesFinal;

    const cicloInicio = cicloOverride ?? `${String(melhorDia).padStart(2,"0")}/${String(mesFinalAdj).padStart(2,"0")}/${anoFinal}`;

    // 3. Escreve as duas linhas de config
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "'App_Config'!A1:B2",
      valueInputOption: "RAW",
      requestBody: {
        values: [
          ["ciclo_inicio",      cicloInicio],
          ["melhor_dia_compra", String(melhorDia)],
        ],
      },
    });

    return Response.json({
      ok: true,
      criada: !exists,
      cicloInicio,
      melhorDiaCompra: melhorDia,
    });
  } catch (e) {
    console.error("[GET /api/finance/setup]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
