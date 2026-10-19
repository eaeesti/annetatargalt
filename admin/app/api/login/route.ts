import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { googleConfig } from "../../../lib/google";
import { setSessionCookie } from "../../../lib/session";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

export async function POST(request: NextRequest) {
  // Where Google sign-in is configured it's the only way in; the backend
  // refuses passwords there too.
  if (googleConfig()) {
    return NextResponse.json({ error: "Sign in with Google" }, { status: 404 });
  }

  const { email, password } = (await request.json()) as {
    email: string;
    password: string;
  };

  const strapiRes = await fetch(`${STRAPI_URL}/api/admin-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!strapiRes.ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const body = (await strapiRes.json()) as { jwt: string };
  const token = body.jwt;

  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, token);

  return response;
}
