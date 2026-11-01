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

const CHOICES: { name: EmailPreferenceName; label: string }[] = [
  { name: "newsletter", label: "Newsletter" },
  { name: "transferEmails", label: "Donations passed on (quarterly)" },
  { name: "yearlyEmails", label: "Yearly summary (December)" },
];

/**
 * Which emails the donor gets besides their confirmations, as they'd choose
 * on the page their emails link to. Each saves as soon as it's clicked, for
 * when a donor asks the team instead.
 */
export function EmailPreferences({
  donorId,
  preferences,
}: {
  donorId: number;
  preferences: Record<EmailPreferenceName, boolean>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // What was clicked, shown until the page is drawn again with it saved
  const [clicked, setClicked] = useState<{
    name: EmailPreferenceName;
    next: boolean;
  } | null>(null);
  const waiting = busy || refreshing;

  async function toggle(name: EmailPreferenceName, next: boolean) {
    setBusy(true);
    setError(null);
    setClicked({ name, next });
    try {
      const res = await fetch(`/api/donors/${donorId}/email-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [name]: next }),
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
            onChange={(e) => toggle(name, e.target.checked)}
          />
          <span>{label}</span>
        </label>
      ))}
      {error && (
        <span role="alert" className="block text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
