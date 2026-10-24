import { CONNECTION_FAILED, failureMessage } from "./failure-message";

/**
 * The largest PDF the backend takes. Uploads pass through a hosting function
 * whose requests are capped at 4.5 MB.
 */
export const MAX_PDF_BYTES = 4 * 1024 * 1024;

const TOO_LARGE = "The file is larger than 4 MB.";

/** Attaches one PDF to a bank line. Gives back what went wrong, or null. */
export async function uploadPdf(
  archivingCode: string,
  file: File,
): Promise<string | null> {
  if (file.size > MAX_PDF_BYTES) return TOO_LARGE;
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    return "Only PDF files can be attached.";
  }

  const form = new FormData();
  form.append("files", file);
  try {
    const res = await fetch(
      `/api/transactions/${encodeURIComponent(archivingCode)}/files`,
      { method: "POST", body: form },
    );
    if (res.ok) return null;
    // the host refuses an oversized request before the backend sees it
    if (res.status === 413) return TOO_LARGE;
    return await failureMessage(res, "Couldn't attach the PDF.");
  } catch {
    return CONNECTION_FAILED;
  }
}

/** "820 KB", "1.4 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
