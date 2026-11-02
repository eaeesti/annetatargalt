import { NextResponse } from "next/server";
import { clearSessionCookie } from "../../../lib/session";

export function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
