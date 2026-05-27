/**
 * create-health-sheet.mjs
 * Cria a aba App_Saude no Google Sheets com cabeçalho.
 *
 * Execução: node scripts/create-health-sheet.mjs
 */

import { google } from "googleapis";
import { readFileSync } from "fs";

const SHEET_ID = process.env.SPREADSHEET_ID;
if (!SHEET_ID) throw new Error("SPREADSHEET_ID não definido");

const KEY_PATH = process.env.GOOGLE_KEY_PATH ?? "./service-account.json";
const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));

const auth = new google.auth.GoogleAuth({
  credentials: key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

async function run() {
  // 1. Cria a aba
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: "App_Saude" },
          },
        }],
      },
    });
    console.log("✓ Aba App_Saude criada");
  } catch (e) {
    if (e.message?.includes("already exists")) {
      console.log("⚠ Aba App_Saude já existe, pulando criação");
    } else throw e;
  }

  // 2. Escreve cabeçalho
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: "'App_Saude'!A1:H1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["Data", "Passos", "Calorias", "Distancia_km", "BPM_Repouso", "BPM_Media", "Sono_h", "Sono_Profundo_h"]],
    },
  });
  console.log("✓ Cabeçalho escrito: Data | Passos | Calorias | Distancia_km | BPM_Repouso | BPM_Media | Sono_h | Sono_Profundo_h");
}

run().catch(e => { console.error(e.message); process.exit(1); });
