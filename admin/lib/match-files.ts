/**
 * Suggests which payment a PDF belongs to, from a reference that appears
 * both in the file's name and in the payment's bank description, such as the
 * code a recipient puts on its receipt.
 */

/**
 * The reference-like words in `text`: five characters or more, with letters
 * and digits both. Plain words, amounts and years don't single out a
 * payment, so they're left out.
 */
export function referenceTokens(text: string): Set<string> {
  return new Set(
    text
      .toUpperCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 5 && /\p{L}/u.test(t) && /\p{N}/u.test(t)),
  );
}

/**
 * The archiving code of the one payment whose description shares a reference
 * with the file name, or whose archiving code is in it. Null when none does,
 * or when more than one does.
 */
export function matchPayment(
  fileName: string,
  payments: { archivingCode: string; description: string | null }[],
): string | null {
  const name = fileName.replace(/\.pdf$/i, "");
  const tokens = referenceTokens(name);
  const words = new Set(name.toUpperCase().split(/[^\p{L}\p{N}-]+/u));

  const matches = payments.filter(
    (p) =>
      words.has(p.archivingCode.toUpperCase()) ||
      [...referenceTokens(p.description ?? "")].some((t) => tokens.has(t)),
  );
  return matches.length === 1 ? (matches[0]?.archivingCode ?? null) : null;
}
