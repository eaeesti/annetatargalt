"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CONNECTION_FAILED,
  failureMessage,
} from "../../../../../lib/failure-message";

export type EmailPreferenceName =
  | "newsletter"
  | "transferEmails"
  | "yearlyEmails";

export type EmailLocale = "et" | "en" | null;

const LANGUAGES: { value: string; label: string }[] = [
  { value: "", label: "The one they last gave in" },
  { value: "et", label: "Estonian" },
  { value: "en", label: "English" },
];

function emailLocaleOf(value: string): EmailLocale {
  return value === "et" || value === "en" ? value : null;
}

const CHOICES: { name: EmailPreferenceName; label: string }[] = [
  { name: "newsletter", label: "Newsletter" },
  { name: "transferEmails", label: "Donations passed on (quarterly)" },
  { name: "yearlyEmails", label: "Yearly summary (December)" },
];

/**
 * Which emails the donor gets besides their confirmations, and in which
 * language, as they'd choose on the page their emails link to. Each saves as
 * soon as it's changed, for when a donor asks the team instead.
 */
export function EmailPreferences({
  donorId,
  preferences,
  emailLocale,
}: {
  donorId: number;
  preferences: Record<EmailPreferenceName, boolean>;
  /** Undefined from a backend older than this page. */
  emailLocale?: EmailLocale;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // What was clicked, shown until the page is drawn again with it saved
  const [clicked, setClicked] = useState<
    | { name: EmailPreferenceName; next: boolean }
    | { name: "emailLocale"; next: EmailLocale }
    | null
  >(null);
  const waiting = busy || refreshing;

  async function change(
    changed:
      | { name: EmailPreferenceName; next: boolean }
      | { name: "emailLocale"; next: EmailLocale },
  ) {
    setBusy(true);
    setError(null);
    setClicked(changed);
    try {
      const res = await fetch(`/api/donors/${donorId}/email-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [changed.name]: changed.next }),
      });
      if (!res.ok) {
        setClicked(null);
        setError(await failureMessage(res, "Couldn't save the change."));
        return;
      }
      startRefresh(() => router.refresh());
    } catch {
      setClicked(null);
      setError(CONNECTION_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5 text-sm">
      {CHOICES.map(({ name, label }) => (
        <label key={name} className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={
              waiting && clicked?.name === name
                ? clicked.next
                : preferences[name]
            }
            disabled={waiting}
            onChange={(e) => change({ name, next: e.target.checked })}
          />
          <span>{label}</span>
        </label>
      ))}
      {emailLocale !== undefined && (
        <label className="flex flex-wrap items-center gap-2 pt-1">
          <span>Language</span>
          <select
            className="h-7 rounded-md border border-input bg-transparent px-1.5 text-sm disabled:opacity-50"
            value={
              (waiting && clicked?.name === "emailLocale"
                ? clicked.next
                : emailLocale) ?? ""
            }
            disabled={waiting}
            onChange={(e) =>
              change({
                name: "emailLocale",
                next: emailLocaleOf(e.target.value),
              })
            }
          >
            {LANGUAGES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <span role="alert" className="block text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
