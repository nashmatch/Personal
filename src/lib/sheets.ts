// Minimal Google Sheets client using the Web Crypto API + fetch — no
// `googleapis`/`google-auth-library`, which lean on Node-specific crypto and
// don't run reliably on the Cloudflare Workers runtime. This talks straight
// to the Sheets REST API using a service-account JWT signed with
// crypto.subtle, which Workers (and any modern JS runtime) supports natively.

function getConfig() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  return { email, privateKey, sheetId };
}

export function isSheetsConfigured() {
  const { email, privateKey, sheetId } = getConfig();
  return Boolean(email && privateKey && sheetId);
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeString(s: string): string {
  return base64UrlEncode(new TextEncoder().encode(s));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const contents = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(contents);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(): Promise<string> {
  const { email, privateKey } = getConfig();
  if (!email || !privateKey) throw new Error("Google service account not configured");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64UrlEncode(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function ensureSheetTab(accessToken: string, spreadsheetId: string, title: string) {
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) throw new Error(`Failed to read spreadsheet: ${metaRes.status} ${await metaRes.text()}`);
  const meta = (await metaRes.json()) as { sheets?: { properties?: { title?: string } }[] };
  const exists = meta.sheets?.some((s) => s.properties?.title === title);

  if (!exists) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    });
    if (!res.ok) throw new Error(`Failed to create sheet tab: ${res.status} ${await res.text()}`);
  }
}

/** Overwrites the given tab with a fresh 2D array of values (row 0 = header). */
export async function writeSheetTab(tabName: string, rows: (string | number)[][]) {
  const { sheetId } = getConfig();
  if (!isSheetsConfigured() || !sheetId) {
    throw new Error(
      "Google Sheets isn't configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_SHEET_ID (see README).",
    );
  }

  const accessToken = await getAccessToken();
  await ensureSheetTab(accessToken, sheetId, tabName);

  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${tabName}!A1:Z10000`)}:clear`,
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!clearRes.ok) throw new Error(`Failed to clear sheet tab: ${clearRes.status} ${await clearRes.text()}`);

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${tabName}!A1`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: rows }),
    },
  );
  if (!updateRes.ok) throw new Error(`Failed to write sheet tab: ${updateRes.status} ${await updateRes.text()}`);

  return { spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}` };
}
