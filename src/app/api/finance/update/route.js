import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

// PATCH — atualiza campos editáveis de gastos variáveis, fixos ou parcelas
// Body: { type: "variavel"|"fixo"|"parcela", nomeAtual: string, sheetRow?: number, campos: { ... } }
export async function PATCH(req) {
  try {
    const { type, nomeAtual, sheetRow: directRow, campos } = await req.json();
    if (!type || (!nomeAtual?.trim() && !directRow) || !campos) {
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
        range: "'App_Parcelas'!A2:I300",
      });
      const rows = res.data.values ?? [];
      let idx;
      if (directRow) {
        idx = directRow - 2; // sheetRow 2 = index 0
      } else {
        // Prefere linha ativa (H != FALSE); aceita inativa só se não houver ativa
        const name = (nomeAtual ?? "").trim().toLowerCase();
        idx = rows.findIndex(
          r => String(r[0] ?? "").trim().toLowerCase() === name &&
               String(r[7] ?? "TRUE").toUpperCase() !== "FALSE"
        );
        if (idx === -1) idx = rows.findIndex(r => String(r[0] ?? "").trim().toLowerCase() === name);
      }
      if (idx === -1 || idx < 0 || !rows[idx]) return Response.json({ ok: false, error: "Parcela não encontrada" }, { status: 404 });

      const row    = directRow ?? (idx + 2);
      const cur    = rows[idx];
      const dIni   = campos.dataInicio ?? cur[6] ?? "";
      const dFim   = campos.dataFim    ?? cur[1] ?? "";
      const vTotal = campos.valorTotal !== undefined ? parseFloat(campos.valorTotal) : parseFloat(cur[2] ?? "0");

      // Recalcula valorMensal
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

      // Reaplica fórmula E ao mudar datas; F é número calculado em JS (não fórmula)
      if (campos.dataInicio !== undefined || campos.dataFim !== undefined) {
        const fmtE = `=(YEAR(B${row})-YEAR(G${row}))*12+MONTH(B${row})-MONTH(G${row})+1`;
        updates.push({ range: `'App_Parcelas'!E${row}`, values: [[fmtE]] });
        // F: auto → calcula por tempo; manual → reset 0 para limpar qualquer erro
        const isAutoRow = String(campos.auto !== undefined ? (campos.auto ? "TRUE" : "FALSE") : (cur[8] ?? "FALSE")).toUpperCase() === "TRUE";
        const [ms, ys] = String(dIni).split("/").map(Number);
        if (isAutoRow && ms >= 1 && ms <= 12 && ys > 2000) {
          const now = new Date();
          const nowM = now.getMonth() + 1;
          const nowY = now.getFullYear();
          const [me, ye] = String(dFim).split("/").map(Number);
          const nTotal = (me >= 1 && me <= 12 && ye > 2000) ?
            Math.max(1, (ye - ys) * 12 + (me - ms) + 1) : 0;
          const computed = (nowY - ys) * 12 + (nowM - ms) + 1;
          const fVal = nTotal > 0 ? Math.min(nTotal, Math.max(0, computed)) : Math.max(0, computed);
          updates.push({ range: `'App_Parcelas'!F${row}`, values: [[fVal]] });
        } else {
          updates.push({ range: `'App_Parcelas'!F${row}`, values: [[0]] });
        }
      }

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
