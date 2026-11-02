import type { NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_MAX_AGE } from "./auth";

const SESSION_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
} as const;

/** Stores the Strapi JWT the bridge issued as this panel's session. */
export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    ...SESSION_COOKIE,
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * Ends the session. The deletion has to carry the cookie's own attributes:
 * browsers ignore a __Host- cookie without Secure, deletions included, and
 * the session would outlive the sign-out.
 */
export function clearSessionCookie(response: NextResponse) {
  response.cookies.delete({ name: COOKIE_NAME, ...SESSION_COOKIE });
}
