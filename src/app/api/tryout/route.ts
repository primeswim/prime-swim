import { google } from "googleapis";
import { NextResponse } from "next/server";
import path from "path";
import { readFileSync } from "fs";

export async function POST(request: Request) {
  const data = await request.json();

  // ⬇️ 这里直接读取本地JSON文件
  const keyFilePath = path.join(process.cwd(), "service-account.json");
  const credentials = JSON.parse(readFileSync(keyFilePath, "utf-8"));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Spreadsheet ID 还是用环境变量
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    console.error("Missing GOOGLE_SHEET_ID");
    return NextResponse.json({ error: "Spreadsheet ID missing" }, { status: 500 });
  }

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
