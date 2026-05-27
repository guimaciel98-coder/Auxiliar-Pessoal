import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

// PATCH — atualiza campos editáveis de gastos variáveis, fixos ou parcelas
// Body: { type: "variavel"|"fixo"|"parcela", nomeAtual: string, campos: { ... } }
export async function PATCH(req) {
  try {
    const { type, nomeAtual, campos } = await req.json();
    if (!type || !nomeAtual?.trim() || !campos) {
      return Response.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    const ssId   = getSpreadsheetId();

    // ── Variável ou Fixo ──────────────────────────────────────────────────────
    if (type === "variavel" || type === "fixo") {
      const tab = type === "variavel" ? "App_Gastos_Variaveis" : "App_Gastos_Fixos";
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: ssId,
        range: `'${tab}'!A2:D500`,
      });
      const rows = res.data.values ?? [];
      const idx  = rows.findIndex(
        r => String(r[1] ?? "").trim().toLowerCase() === nomeAtual.trim().toLowerCase()
      );
      if (idx === -1) return Response.json({ ok: false, error: "Item não encontrado" }, { status: 404 });

      const row = idx + 2;
      const updates = [];
      if (campos.grupo    !== undefined) updates.push({ range: `'${tab}'!A${row}`, values: [[campos.grupo]] });
      if (campos.nome     !== undefined) updates.push({ range: `'${tab}'!B${row}`, values: [[campos.nome]] });
      if (campos.previsao !== undefined) updates.push({ range: `'${tab}'!C${row}`, values: [[campos.previsao]] });
      if (type === "fixo" && campos.real !== undefined) updates.push({ range: `'${tab}'!D${row}`, values: [[campos.real]] });
      if (type === "fixo" && campos.auto !== undefined) updates.push({ range: `'${tab}'!F${row}`, values: [[campos.auto ? "TRUE" : "FALSE"]] });

      if (updates.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: ssId,
          requestBody: { valueInputOption: "USER_ENTERED", data: updates },
        });
      }
      return Response.json({ ok: true });
    }

    // ── Parcela ───────────────────────────────────────────────────────────────
    if (type === "parcela") {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: ssId,
        range: "'App_Parcelas'!A2:G300",
      });
      const rows = res.data.values ?? [];
      const idx  = rows.findIndex(
        r => String(r[0] ?? "").trim().toLowerCase() === nomeAtual.trim().toLowerCase()
      );
      if (idx === -1) return Response.json({ ok: false, error: "Parcela não encontrada" }, { status: 404 });

      const row    = idx + 2;
      const cur    = rows[idx];
      const dIni   = campos.dataInicio ?? cur[6] ?? "";
      const dFim   = campos.dataFim    ?? cur[1] ?? "";
      const vTotal = campos.valorTotal !== undefined ? parseFloat(campos.valorTotal) : parseFloat(cur[2] ?? "0");

      // Recalcula valorMensal e totalParcelas
      let vMensal = vTotal;
      if (dIni && dFim) {
        const [ms, ys] = dIni.split("/").map(Number);
        const [me, ye] = dFim.split("/").map(Number);
        const nParc = Math.max(1, (ye - ys) * 12 + (me - ms) + 1);
        vMensal = Math.round((vTotal / nParc) * 100) / 100;
      }

      const updates = [];
      if (campos.nome       !== undefined) updates.push({ range: `'App_Parcelas'!A${row}`, values: [[campos.nome]] });
      if (campos.dataFim    !== undefined) updates.push({ range: `'App_Parcelas'!B${row}`, values: [[campos.dataFim]] });
      if (campos.auto       !== undefined) updates.push({ range: `'App_Parcelas'!I${row}`, values: [[campos.auto ? "TRUE" : "FALSE"]] });
      if (campos.valorTotal !== undefined) {
        updates.push({ range: `'App_Parcelas'!C${row}`, values: [[vTotal]] });
        updates.push({ range: `'App_Parcelas'!D${row}`, values: [[vMensal]] });
      }
      if (campos.dataInicio !== undefined) updates.push({ range: `'App_Parcelas'!G${row}`, values: [[campos.dataInicio]] });

      if (updates.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: ssId,
          requestBody: { valueInputOption: "USER_ENTERED", data: updates },
        });
      }
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: "Tipo inválido" }, { status: 400 });
  } catch (e) {
    console.error("[PATCH /api/finance/update]", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
