import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import {
  GOOGLE_ERRORS,
  googleConfig,
  isGoogleErrorCode,
} from "../../lib/google";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return (
    <LoginForm
      googleEnabled={googleConfig() !== null}
      initialError={isGoogleErrorCode(error) ? GOOGLE_ERRORS[error] : null}
    />
  );
}
