import Link from "next/link";
import { TransferBuilder } from "../_components/transfer-builder";

export default function NewTransferPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/transfers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Transfers
        </Link>
        <h1 className="text-2xl font-bold">New transfer round</h1>
        <p className="text-sm text-muted-foreground">
          Pick a date range to seed the list of finalized, not-yet-transferred
          donations, adjust it, then create the round.
        </p>
      </div>
      <TransferBuilder />
    </div>
  );
}
