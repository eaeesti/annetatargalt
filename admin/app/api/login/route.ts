import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { googleConfig } from "../../../lib/google";
import { readJson } from "../../../lib/read-json";
import { setSessionCookie } from "../../../lib/session";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

/** Whether a request body has the email and password the sign-in form sends. */
function isCredentials(
  body: unknown,
): body is { email: string; password: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    "password" in body &&
    typeof body.email === "string" &&
    typeof body.password === "string"
  );
}

export async function POST(request: NextRequest) {
  // Where Google sign-in is configured it's the only way in; the backend
  // refuses passwords there too.
  if (googleConfig()) {
    return NextResponse.json({ error: "Sign in with Google" }, { status: 404 });
  }

  // The body is whatever the browser sent, so it's checked, not trusted.
  const credentials: unknown = await request.json().catch(() => null);
  if (!isCredentials(credentials)) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }
  const { email, password } = credentials;

  const strapiRes = await fetch(`${STRAPI_URL}/api/admin-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!strapiRes.ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const body = await readJson<{ jwt: string }>(strapiRes);
  const token = body.jwt;

  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, token);

  return response;
}
