/**
 * Parse an operator-typed euro amount into integer cents, or null if it isn't
 * a number. Accepts a leading "-", spaces as thousands separators, and either
 * decimal convention: "7.37", "-12,50", "1 234,56", "1,234.56", "-1 200,00".
 * A lone "." in an all-3-digit-grouped number ("1.234") is read as an Estonian
 * thousands separator, not a fractional cent.
 */
export function euroInputToCents(raw: string): number | null {
  const s = raw.trim().replace(/[\s ]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized = s;
  if (lastComma > -1 && lastDot > -1) {
    // both present → the later one is the decimal separator
    const dec = lastComma > lastDot ? "," : ".";
    const thou = dec === "," ? "." : ",";
    normalized = s.split(thou).join("").replace(dec, ".");
  } else if (lastComma > -1) {
    // comma-decimal with dots as thousands ("1.234,56") or a plain "12,50"
    normalized = s.split(".").join("").replace(",", ".");
  } else if (lastDot > -1 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.split(".").join("");
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
