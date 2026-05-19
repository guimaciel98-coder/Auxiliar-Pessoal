/**
 * Google Sheets API client — autenticação via Service Account.
 *
 * Variáveis de ambiente necessárias (.env.local e Vercel):
 *   GOOGLE_SPREADSHEET_ID  — ID da planilha (string longa na URL do Sheets)
 *   GOOGLE_CLIENT_EMAIL    — email da service account (ex: nome@projeto.iam.gserviceaccount.com)
 *   GOOGLE_PRIVATE_KEY     — chave privada RSA (com \n escapados)
 */

import { google } from "googleapis";

/** Retorna um cliente autenticado do Google Sheets */
export async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

/** ID da planilha (lido do env) */
export function getSpreadsheetId() {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!id) throw new Error("GOOGLE_SPREADSHEET_ID não configurada no ambiente");
  return id;
}

/**
 * Converte índice de coluna (0-based) para letra(s).
 * colToLetter(0)  → "A"
 * colToLetter(25) → "Z"
 * colToLetter(26) → "AA"
 */
export function colToLetter(index) {
  let result = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * Normaliza string para comparação: remove espaços, lowercase, sem acentos.
 * Útil para encontrar categorias/datas mesmo com variações de formatação.
 */
export function normalize(str) {
  return String(str ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
