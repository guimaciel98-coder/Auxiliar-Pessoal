import { getSheetsClient, getSpreadsheetId } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

const SHEET = "App_Parcelas";

// Colunas (A-I):
// A: Nome | B: DataFim (M/YYYY) | C: ValorTotal | D: ValorMensal
// E: TotalParcelas (fórmula) | F: ParcelasPagas (fórmula) | G: DataInicio (M/YYYY) | H: Ativo | I: Auto

function parseNum(raw) {
  return parseFloat(String(raw ?? "0").trim().replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
}

// Fórmulas Google Sheets — referenciam B e G da mesma linha
function formulaTotalParcelas(row) {
  return `=DATEDIF(DATE(MID(G${row},FIND("/",G${row})+1,4),LEFT(G${row},FIND("/",G${row})-1),1),DATE(MID(B${row},FIND("/",B${row})+1,4),LEFT(B${row},FIND("/",B${row})-1),1),"M")+1`;
}
function formulaParcelasPagas(row) {
  return `=MIN(E${row},MAX(0,DATEDIF(DATE(MID(G${row},FIND("/",G${row})+1,4),LEFT(G${row},FIND("/",G${row})-1),1),TODAY(),"M")))`;
}

async function ensureSheet(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets.find(s => s.properties.title === SHEET);
  if (!existing) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${SHEET}'!A1:I1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [["Nome", "DataFim", "ValorTotal", "ValorMensal", "TotalParcelas", "ParcelasPagas", "DataInicio", "Ativo", "Auto"]],
      },
    });
    return res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
  }
  return existing.properties.sheetId;
}

// GET — lê Col E e F diretamente (resultado das fórmulas)
export async function GET() {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    await ensureSheet(sheets, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET}'!A2:I300`,
    });

    const rows = res.data.values ?? [];
    const items = rows
      .map((row, i) => {
        const [nome, dataFim, valorTotal, valorMensal, totalParcelas, parcelasPagas, dataInicio, ativo, autoCol] = row;
        if (String(ativo ?? "TRUE").toUpperCase() === "FALSE") return null;
        if (!nome?.trim()) return null;

        const vTotal  = parseNum(valorTotal);
        const vMensal = parseNum(valorMensal);
        const nTotal  = Math.max(0, parseInt(totalParcelas ?? "0") || 0);
        const isAuto   = String(autoCol ?? "FALSE").toUpperCase() === "TRUE";
        const rawPagas = Math.min(nTotal, Math.max(0, parseInt(parcelasPagas ?? "0") || 0));
        // Cap de meses decorridos só se aplica a parcelas automáticas;
        // manuais confiam no valor gravado pelo usuário
        const _now = new Date();
        const _pm  = _now.getMonth() === 0 ? 12 : _now.getMonth();
        const _py  = _now.getMonth() === 0 ? _now.getFullYear() - 1 : _now.getFullYear();
        const _parts = String(dataInicio ?? "0/0").split("/");
        const _ms = parseInt(_parts[0]), _ys = parseInt(_parts[1]);
        const _maxP  = (isAuto && _ms && _ys) ? Math.max(0, Math.min(nTotal, (_py - _ys) * 12 + (_pm - _ms) + 1)) : nTotal;
        const nPagas = Math.min(rawPagas, _maxP);

        return {
          sheetRow:          i + 2,
          nome:              nome.trim(),
          dataFim:           dataFim ?? "",
          dataInicio:        dataInicio ?? "",
          valorTotal:        vTotal,
          valorMensal:       vMensal,
          totalParcelas:     nTotal,
          parcelasPagas:     nPagas,
          parcelasRestantes: nTotal - nPagas,
          totalPago:         vMensal * nPagas,
          restante:          vMensal * (nTotal - nPagas),
          auto:              isAuto,
        };
      })
      .filter(Boolean);

    return Response.json({ ok: true, items });
  } catch (e) {
    console.error("[GET /api/finance/installments]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST — cria nova parcela; copia fórmulas da linha anterior via copyPaste
export async function POST(req) {
  try {
    const { nome, dataFim, valorTotal, dataInicio } = await req.json();

    if (!nome?.trim())  return Response.json({ error: "Nome é obrigatório" }, { status: 400 });
    if (!valorTotal || parseFloat(valorTotal) <= 0)
      return Response.json({ error: "Valor total inválido" }, { status: 400 });
    if (!dataInicio)    return Response.json({ error: "Data de início é obrigatória" }, { status: 400 });
    if (!dataFim)       return Response.json({ error: "Data de fim é obrigatória" }, { status: 400 });

    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const sheetId       = await ensureSheet(sheets, spreadsheetId);

    // Calcula ValorMensal a partir das datas
    const [ms, ys] = dataInicio.split("/").map(Number);
    const [me, ye] = dataFim.split("/").map(Number);
    const nParc   = Math.max(1, (ye - ys) * 12 + (me - ms) + 1);
    const vTotal  = parseFloat(valorTotal);
    const vMensal = Math.round((vTotal / nParc) * 100) / 100;

    // 1. Append da nova linha
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range:           `'${SHEET}'!A:I`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[nome.trim(), dataFim, vTotal, vMensal, 0, 0, dataInicio, "TRUE", "FALSE"]],
      },
    });

    // 2. Descobre a linha inserida
    const updatedRange = appendRes.data.updates?.updatedRange ?? "";
    const rowMatch     = updatedRange.match(/!A(\d+)/);
    if (!rowMatch) return Response.json({ ok: true });

    const newRow    = parseInt(rowMatch[1]);
    const sourceRow = newRow - 1; // linha anterior (tem as fórmulas)

    if (sourceRow >= 2) {
      // 3. Descobre quais colunas da linha anterior têm fórmulas
      const formulaRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range:              `'${SHEET}'!A${sourceRow}:I${sourceRow}`,
        valueRenderOption:  "FORMULA",
      });
      const srcCells = formulaRes.data.values?.[0] ?? [];
      // col 5 = F (ParcelasPagas): parcelas criadas via POST são sempre manuais → não copia fórmula
      const formulaCols = srcCells.reduce((acc, cell, idx) => {
        if (typeof cell === "string" && cell.startsWith("=") && idx !== 5) acc.push(idx);
        return acc;
      }, []);

      if (formulaCols.length > 0) {
        // 4. copyPaste apenas das colunas com fórmula
        const requests = formulaCols.map(colIdx => ({
          copyPaste: {
            source:      { sheetId, startRowIndex: sourceRow - 1, endRowIndex: sourceRow,      startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
            destination: { sheetId, startRowIndex: newRow - 1,    endRowIndex: newRow,          startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
            pasteType: "PASTE_FORMULA",
          },
        }));
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests },
        });
      }
    } else {
      // Fallback: primeira linha do sheet — escreve fórmulas diretamente
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: [
            { range: `'${SHEET}'!E${newRow}`, values: [[formulaTotalParcelas(newRow)]] },
            { range: `'${SHEET}'!F${newRow}`, values: [[formulaParcelasPagas(newRow)]] },
          ],
        },
      });
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/finance/installments]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Converte texto "Até maio/26", "junho/26" etc. → "M/YYYY"
const MES_PT = {
  janeiro:1, fevereiro:2, marco:3, abril:4, maio:5, junho:6,
  julho:7, agosto:8, setembro:9, outubro:10, novembro:11, dezembro:12,
  jan:1, fev:2, mar:3, abr:4, mai:5, jun:6,
  jul:7, ago:8, set:9, out:10, nov:11, dez:12,
};
function migrateDataFim(raw) {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (/^\d{1,2}\/\d{4}$/.test(s)) return s; // já no formato correto
  const match = s.match(/([a-záàâãçéêíóôõú]+)\/(\d{2,4})/i);
  if (!match) return null;
  const key = match[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const m   = MES_PT[key];
  let   y   = parseInt(match[2]);
  if (y < 100) y += 2000;
  return (m && y > 2000) ? `${m}/${y}` : null;
}

// PUT — migra Col B para M/YYYY e aplica fórmulas em E e F
export async function PUT() {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET}'!A2:I300`,
    });

    const rows = res.data.values ?? [];
    const updates = [];
    let migrated = 0;

    rows.forEach((row, i) => {
      if (!row[0]?.toString().trim()) return;
      const rowNum = i + 2;

      // Migra Col B se necessário
      const rawB    = row[1] ?? "";
      const fixedB  = migrateDataFim(rawB);
      if (fixedB && fixedB !== rawB) {
        updates.push({ range: `'${SHEET}'!B${rowNum}`, values: [[fixedB]] });
        migrated++;
      }

      // Fórmulas E e F
      updates.push({ range: `'${SHEET}'!E${rowNum}`, values: [[formulaTotalParcelas(rowNum)]] });
      updates.push({ range: `'${SHEET}'!F${rowNum}`, values: [[formulaParcelasPagas(rowNum)]] });
    });

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data: updates },
      });
    }

    return Response.json({ ok: true, rowsUpdated: rows.filter(r => r[0]?.toString().trim()).length, migrated });
  } catch (e) {
    console.error("[PUT /api/finance/installments]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// PATCH — registra pagamento manual de 1 parcela (incrementa F em +1, desativa se concluída)
export async function PATCH(req) {
  try {
    const { sheetRow } = await req.json();
    if (!sheetRow) return Response.json({ ok: false, error: "sheetRow obrigatório" }, { status: 400 });

    const sheets        = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // Lê E (valor calculado) e F com FORMULA para detectar se F ainda tem fórmula automática
    const [resE, resF] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: `'${SHEET}'!E${sheetRow}` }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: `'${SHEET}'!F${sheetRow}`, valueRenderOption: "FORMULA" }),
    ]);
    const totalStr   = resE.data.values?.[0]?.[0] ?? "0";
    const fCell      = resF.data.values?.[0]?.[0] ?? "0";
    const hasFormula = typeof fCell === "string" && fCell.startsWith("=");
    const total      = parseInt(totalStr) || 0;
    const pagas      = hasFormula ? 0 : (parseInt(String(fCell)) || 0);
    const newPagas   = pagas + 1;

    const updates = [{ range: `'${SHEET}'!F${sheetRow}`, values: [[String(newPagas)]] }];
    if (total > 0 && newPagas >= total) {
      updates.push({ range: `'${SHEET}'!H${sheetRow}`, values: [["FALSE"]] });
    }
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });

    return Response.json({ ok: true, newPagas, concluida: total > 0 && newPagas >= total });
  } catch (e) {
    console.error("[PATCH /api/finance/installments]", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
