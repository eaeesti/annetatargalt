"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../../components/ui/button";
import {
  CONNECTION_FAILED,
  failureMessage,
} from "../../../../lib/failure-message";
import { readJson } from "../../../../lib/read-json";

/**
 * Starts a draft and opens it: a new one, or a copy of the email `copyOf`.
 */
export function NewEmailButton({
  copyOf,
  children,
  variant,
}: {
  copyOf?: number;
  children: React.ReactNode;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        copyOf ? `/api/emails/${copyOf}/duplicate` : "/api/emails",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      if (!res.ok) {
        setError(await failureMessage(res, "Couldn't start the email."));
        return;
      }
      const { data } = await readJson<{ data: { id: number } }>(res);
      router.push(`/emails/${data.id}`);
    } catch {
      setError(CONNECTION_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant={variant} disabled={busy} onClick={create}>
        {children}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
