/**
 * /api/routine/blocks
 *
 * App_Rotina schema (A:E):
 *   A: Dia (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb)
 *   B: Inicio (HH:MM)
 *   C: Fim    (HH:MM)
 *   D: Atividade
 *   E: Categoria (treino|trabalho|pessoal|livre)
 *
 * GET  ?day=N         → blocos do dia
 * POST (migrate=1)    → migra dados de Rotina Treino Manhâ → App_Rotina
 * PUT  { sheetRow, atividade, categoria, inicio, fim }
 * DELETE { sheetRow }
 */
import { getSheetsClient } from "@/lib/googleSheets";
import { fetchWeekRoutine } from "@/lib/routineService";

export const dynamic = "force-dynamic";

const ID    = process.env.GOOGLE_ROUTINE_SPREADSHEET_ID ?? "13y2HHURgSwQp9k29w8IF6V8_QEZNskMF7j0ENOM8Gpk";
const SHEET = "App_Rotina";

const DAY_NAMES = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

function pad(n) { return String(n).padStart(2,"0"); }
function minsToHHMM(m) { return `${pad(Math.floor(m/60))}:${pad(m%60)}`; }

async function ensureSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  if (!meta.data.sheets?.find(s => s.properties.title === SHEET)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: ID, range: `'${SHEET}'!A1:E1`,
      valueInputOption: "RAW",
      requestBody: { values: [["Dia","Inicio","Fim","Atividade","Categoria"]] },
    });
  }
}

// GET — lê todos os blocos (ou filtra por dia)
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const day = searchParams.get("day");

  try {
    const sheets = await getSheetsClient();
    await ensureSheet(sheets);

    const res  = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${SHEET}'!A2:E1000` });
    const rows = res.data.values ?? [];

    const blocks = rows
      .map((r, i) => ({
        sheetRow:  i + 2,
        dia:       parseInt(r[0]) || 0,
        inicio:    r[1] ?? "",
        fim:       r[2] ?? "",
        atividade: r[3] ?? "",
        categoria: r[4] ?? "livre",
      }))
      .filter(b => b.atividade && (!day || String(b.dia) === String(day)));

    return Response.json({ ok: true, blocks });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST — migra dados ou cria bloco individual
export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const sheets = await getSheetsClient();
  await ensureSheet(sheets);

  // Migração completa
  if (body.migrate) {
    let rows;

    if (Array.isArray(body.rows)) {
      // Dados explícitos fornecidos diretamente — limpa e reescreve sem ler planilha
      rows = body.rows;
    } else {
      // fromOriginal: limpa App_Rotina antes de ler, forçando fallback para a planilha original
      if (body.fromOriginal) {
        await sheets.spreadsheets.values.clear({ spreadsheetId: ID, range: `'${SHEET}'!A2:E1000` });
      }
      const week = await fetchWeekRoutine();
      rows = [];
      for (const [jsDay, blocks] of Object.entries(week)) {
        const day = parseInt(jsDay);
        for (let i = 0; i < blocks.length; i++) {
          const b    = blocks[i];
          const next = blocks[i + 1];
          const fim  = next ? minsToHHMM(next.minutes) : minsToHHMM((b.minutes + b.duration) % 1440);
          rows.push([day, minsToHHMM(b.minutes), fim, b.activity, b.category]);
        }
      }
      rows.sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1].localeCompare(b[1]));
    }

    await sheets.spreadsheets.values.clear({ spreadsheetId: ID, range: `'${SHEET}'!A2:E1000` });
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: ID, range: `'${SHEET}'!A2:E${rows.length + 1}`,
        valueInputOption: "RAW", requestBody: { values: rows },
      });
    }
    return Response.json({ ok: true, migrated: rows.length });
  }

  // Cria um novo bloco
  const { dia, inicio, fim, atividade, categoria = "livre" } = body;
  if (!atividade) return Response.json({ ok: false, error: "atividade obrigatória" }, { status: 400 });
  await sheets.spreadsheets.values.append({
    spreadsheetId: ID, range: `'${SHEET}'!A:E`,
    valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[dia ?? 1, inicio ?? "", fim ?? "", atividade, categoria]] },
  });
  return Response.json({ ok: true });
}

// PUT — atualiza bloco existente
export async function PUT(req) {
  const { sheetRow, atividade, categoria, inicio, fim } = await req.json();
  if (!sheetRow) return Response.json({ ok: false, error: "sheetRow obrigatório" }, { status: 400 });

  try {
    const sheets = await getSheetsClient();
    const updates = [];
    if (atividade !== undefined && atividade !== "") updates.push({ range: `'${SHEET}'!D${sheetRow}`, values: [[atividade]] });
    if (categoria !== undefined && categoria !== "") updates.push({ range: `'${SHEET}'!E${sheetRow}`, values: [[categoria]] });
    if (inicio    !== undefined && inicio    !== "") updates.push({ range: `'${SHEET}'!B${sheetRow}`, values: [[inicio]] });
    if (fim       !== undefined && fim       !== "") updates.push({ range: `'${SHEET}'!C${sheetRow}`, values: [[fim]] });

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: ID,
        requestBody: { valueInputOption: "RAW", data: updates },
      });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// DELETE — remove bloco (limpa linha)
export async function DELETE(req) {
  const { sheetRow } = await req.json();
  if (!sheetRow) return Response.json({ ok: false, error: "sheetRow obrigatório" }, { status: 400 });

  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.clear({ spreadsheetId: ID, range: `'${SHEET}'!A${sheetRow}:E${sheetRow}` });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
