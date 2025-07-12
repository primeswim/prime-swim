import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const data = await request.json();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sheet1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          new Date().toISOString(),
          data.firstName || "",
          data.lastName || "",
          data.email || "",
          data.phone || "",
          data.age || "",
          data.program || "",
          data.experience || "",
          data.preferredDate || "",
          data.preferredTime || "",
          data.notes || "",
        ],
      ],
    },
  });

  return NextResponse.json({ success: true });
}
