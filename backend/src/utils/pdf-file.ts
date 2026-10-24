/**
 * Checks for PDFs uploaded through the admin panel.
 */

/**
 * The largest file accepted. The admin panel passes uploads on through a
 * hosting function whose requests are capped at 4.5 MB, form encoding
 * included.
 */
export const MAX_PDF_BYTES = 4 * 1024 * 1024;

const PDF_HEADER = Buffer.from("%PDF-");

/**
 * Whether `data` is a PDF. Readers accept the header anywhere in the first
 * 1024 bytes, and some generators put a few bytes before it.
 */
export function isPdf(data: Buffer): boolean {
  return data.subarray(0, 1024).includes(PDF_HEADER);
}

const MAX_NAME_LENGTH = 255;

/**
 * An uploaded file's name, fit to store and to show: no folders, no control
 * characters, no runs of spaces, and at most 255 characters with the
 * extension kept.
 */
export function cleanFileName(name: string | null | undefined): string {
  const base = (name ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/\s+/g, " ")
    // oxlint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (!cleaned) return "document.pdf";
  if (cleaned.length <= MAX_NAME_LENGTH) return cleaned;

  const dot = cleaned.lastIndexOf(".");
  const extension =
    dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return (
    cleaned.slice(0, MAX_NAME_LENGTH - extension.length).trimEnd() + extension
  );
}

/**
 * A Content-Disposition header that opens the file in the browser and saves
 * it under its own name. The plain `filename` is an ASCII stand-in for
 * clients that don't read the UTF-8 `filename*`.
 */
export function inlineDisposition(fileName: string): string {
  const ascii = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\]/g, "")
    .trim();
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${ascii || "document.pdf"}"; filename*=UTF-8''${encoded}`;
}
