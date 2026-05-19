import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

/**
 * POST /api/finance/expense
 *
 * Registra um gasto variável do dia na aba "Lançamentos".
 * O bloco atual de "Gastos Variaveis Dia" usa fórmulas SUMIFS que
 * leem de Lançamentos — não é necessário escrever na matriz diretamente.
 *
 * Body: { category: string, value: number }
 */

const LOG = "App_Lancamentos";

function toSheetNum(n) {
  return Number(n).toFixed(2).replace(".", ",");
}

function fmtDateFull(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Payload JSON inválido" }, { status: 400 });
  }

  const { category, value } = body ?? {};

  if (!category || typeof category !== "string" || !category.trim()) {
    return Response.json({ ok: false, error: "category (string) é obrigatório" }, { status: 400 });
  }
  if (value === undefined || value === null || isNaN(Number(value)) || Number(value) <= 0) {
    return Response.json({ ok: false, error: "value deve ser um número positivo" }, { status: 400 });
  }

  try {
    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const today         = fmtDateFull();
    const numValue      = Number(value);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${LOG}'!A:D`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[today, "", category.trim(), toSheetNum(numValue)]],
      },
    });

    return Response.json({
      ok: true,
      category: category.trim(),
      date:     today,
      added:    numValue,
    });
  } catch (e) {
    console.error("[POST /api/finance/expense]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
