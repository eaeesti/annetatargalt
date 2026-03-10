import { NextResponse } from "next/server";
import { COOKIE_NAME } from "../../../lib/auth";

export function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
