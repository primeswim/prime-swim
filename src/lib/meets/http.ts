import { NextResponse } from "next/server";

export const PRIVATE_MEET_HEADERS = { "Cache-Control": "no-store" };

export function privateMeetJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: PRIVATE_MEET_HEADERS });
}
