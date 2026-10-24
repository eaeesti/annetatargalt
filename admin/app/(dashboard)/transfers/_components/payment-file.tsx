"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, LoaderCircle, Paperclip, X } from "lucide-react";
import { ConfirmButton } from "../../../../components/confirm-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../../components/ui/tooltip";
import {
  CONNECTION_FAILED,
  failureMessage,
} from "../../../../lib/failure-message";
import { formatBytes, uploadPdf } from "../../../../lib/pdf-upload";

export type AttachedFile = {
  id: number;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
};

/**
 * A payment's PDF as an icon for a narrow table column: the file, which
 * opens in a new tab and can be removed, or a paperclip to attach one. A
 * payment has at most one. An upload that fails is reported through
 * `onError`, for the table to show below itself.
 */
export function PaymentFile({
  archivingCode,
  file,
  paymentLabel,
  onError,
}: {
  archivingCode: string;
  file: AttachedFile | null;
  /** names the payment for screen readers, e.g. "the €120.00 payment of 2026-03-02" */
  paymentLabel: string;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function attach(chosen: File) {
    setBusy(true);
    onError(null);
    const problem = await uploadPdf(archivingCode, chosen);
    setBusy(false);
    if (problem) onError(`${chosen.name}: ${problem}`);
    else router.refresh();
  }

  async function remove(id: number): Promise<string | null> {
    try {
      const res = await fetch(`/api/transaction-files/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return failureMessage(res, "Couldn't remove the PDF.");
      router.refresh();
      return null;
    } catch {
      return CONNECTION_FAILED;
    }
  }

  if (file) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href={`/api/transaction-files/${file.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/70"
                  aria-label={`Open ${file.fileName}, the PDF of ${paymentLabel}`}
                />
              }
            >
              <FileText className="size-4" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>
              {file.fileName} · {formatBytes(file.sizeBytes)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ConfirmButton
          title={`Remove ${file.fileName}?`}
          description="The PDF is deleted from the server. You can then attach a different one."
          confirmLabel="Remove"
          action={() => remove(file.id)}
          trigger={
            <button
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${file.fileName}`}
            />
          }
        >
          <X className="size-3" aria-hidden />
        </ConfirmButton>
      </span>
    );
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                className="text-muted-foreground hover:text-primary disabled:opacity-50"
                disabled={busy}
                onClick={() => input.current?.click()}
                aria-label={`Attach a PDF to ${paymentLabel}`}
              />
            }
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Paperclip className="size-4" aria-hidden />
            )}
          </TooltipTrigger>
          <TooltipContent>
            {busy ? "Attaching…" : "Attach a PDF"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          // so choosing the same file again fires a change
          e.target.value = "";
          if (chosen) void attach(chosen);
        }}
      />
    </>
  );
}
