import { getSheetsClient } from "@/lib/googleSheets";
export const dynamic = "force-dynamic";
const ID = process.env.GOOGLE_ROUTINE_SPREADSHEET_ID ?? "13y2HHURgSwQp9k29w8IF6V8_QEZNskMF7j0ENOM8Gpk";

export async function GET() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: ID,
    ranges: ["'Rotina Treino Manhâ'!A1:I10"],
    includeGridData: true,
    fields: "sheets.data.rowData.values(formattedValue)",
  });
  const rows = res.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const values = rows.map(r => r.values?.map(c => c.formattedValue ?? "") ?? []);
  return Response.json({ ok: true, values });
}
