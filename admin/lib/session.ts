import type { NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_MAX_AGE } from "./auth";

/** Stores the Strapi JWT the bridge issued as this panel's session. */
export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}
