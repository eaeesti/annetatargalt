"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deductCardFees: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error?.message ?? "Failed to save");
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to save — check your connection and try again");
    } finally {
      setBusy(false);
    }
  }

  return (
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
  );
}
