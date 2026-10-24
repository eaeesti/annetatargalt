"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { BrandLogo } from "../../components/brand-logo";
import { readJson } from "../../lib/read-json";

interface LoginFormProps {
  googleEnabled: boolean;
  /** A message from a Google sign-in that sent the user back here. */
  initialError: string | null;
}

// One way in or the other: where Google sign-in is configured, the backend
// turns password sign-in off.
export function LoginForm({ googleEnabled, initialError }: LoginFormProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-3 text-center">
          <BrandLogo className="mx-auto h-12 text-primary" />
          <h1 className="text-base leading-snug font-medium">
            Anneta Targalt admin
          </h1>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleEnabled ? (
            <GoogleSignIn error={initialError} />
          ) : (
            <PasswordForm />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GoogleSignIn({ error }: { error: string | null }) {
  return (
    <>
      <Button
        className="w-full"
        // A route handler, not a page, and the browser has to leave for
        // Google: this must be a real navigation, not <Link>.
        // oxlint-disable-next-line next/no-html-link-for-pages
        render={<a href="/api/auth/google" />}
      >
        Sign in with Google
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
}

function PasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/");
    } else {
      const body = await readJson<{ error?: string }>(res);
      setError(body.error ?? "Login failed");
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
