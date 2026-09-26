import { google } from "googleapis";

export function isSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_SHEET_ID,
  );
}

function getAuth() {
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function ensureSheetTab(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string, title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
}

/** Overwrites the given tab with a fresh 2D array of values (row 0 = header). */
export async function writeSheetTab(tabName: string, rows: (string | number)[][]) {
  if (!isSheetsConfigured()) {
    throw new Error(
      "Google Sheets isn't configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_SHEET_ID (see README).",
    );
  }
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await ensureSheetTab(sheets, spreadsheetId, tabName);

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${tabName}!A1:Z10000`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  return { spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` };
}
