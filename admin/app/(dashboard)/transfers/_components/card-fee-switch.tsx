"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CONNECTION_FAILED,
  failureMessage,
} from "../../../../lib/failure-message";

/**
 * Whether this round's card fees come off the tip organization's share.
 * Saves as soon as it's clicked.
 */
export function CardFeeSwitch({
  transferId,
  deductCardFees,
  tipOrganizationName,
}: {
  transferId: number;
  deductCardFees: boolean;
  tipOrganizationName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deductCardFees: next }),
      });
      if (!res.ok) {
        setError(await failureMessage(res, "Couldn't save the change."));
        return;
      }
      router.refresh();
    } catch {
      setError(CONNECTION_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="block">
      <label className="inline-flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={deductCardFees}
          disabled={busy}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span>Take them off {tipOrganizationName}&apos;s share</span>
      </label>
      {error && (
        <span role="alert" className="block text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
