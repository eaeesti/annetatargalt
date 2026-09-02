/**
 * Bank reconciliation — match donations to rows in an LHV account-statement CSV.
 *
 * Pure functions only: no database, no `strapi`. Port of the historical
 * `match_donations_to_lhv_transactions.py`. Consumed by the backfill script
 * (`src/scripts/reconcile.ts`) and the admin-panel reconciliation endpoints.
 *
 * The "transaction ID" stored on a donation is the LHV **Arhiveerimistunnus**
 * ("Archiving code") — 16 digits, `YYYYMMDD` + 8 more, assigned by the bank.
 */
import { parse } from "csv-parse/sync";

export type MatchSource =
  | "selgitus-id"
  | "idcode-amount-date"
  | "manual"
  | "recurring-import"
  | "card-payout";

export interface BankTransaction {
  /** Kuupäev, ISO `YYYY-MM-DD` */
  date: string;
  /** Summa, in cents */
  amountCents: number;
  /** Arhiveerimistunnus — the value stored on the donation */
  archivingCode: string;
  /** Selgitus */
  description: string;
  /** Isikukood või registrikood */
  idOrRegCode: string;
  /** Saaja/maksja konto */
  counterpartyAccount: string;
  /** Saaja/maksja nimi */
  counterpartyName: string;
  /** Deebet/Kreedit (D/C) */
  direction: "D" | "C" | "";
}

export interface ReconcilableDonation {
  id: number;
  amountCents: number;
  /** ISO datetime string; only the date part is used */
  datetime: string;
  companyCode: string | null;
  donorIdCode: string | null;
  /** display only — the matcher ignores these */
  donorName?: string | null;
}

export interface ReconciliationReport {
  matched: { donationId: number; archivingCode: string; source: MatchSource }[];
  /** donation matched >1 candidate transaction — needs a human */
  ambiguous: { donationId: number; candidateCodes: string[] }[];
  /** credit transactions no donation resolved to */
  donationlessTransactions: BankTransaction[];
  /** donation ids with no matching transaction */
  transactionlessDonations: number[];
}

// ─── CSV parsing ─────────────────────────────────────────────────────────────

/** Canonical (Estonian) header → field, with English-export aliases. */
const HEADER_ALIASES: Record<string, keyof BankTransaction | "ignore"> = {
  Kuupäev: "date",
  Date: "date",
  Summa: "amountCents",
  Amount: "amountCents",
  Arhiveerimistunnus: "archivingCode",
  "Archiving code": "archivingCode",
  Selgitus: "description",
  Description: "description",
  "Isikukood või registrikood": "idOrRegCode",
  "Personal code or register code": "idOrRegCode",
  "Saaja/maksja konto": "counterpartyAccount",
  "Sender/receiver account": "counterpartyAccount",
  "Saaja/maksja nimi": "counterpartyName",
  "Sender/receiver name": "counterpartyName",
  "Deebet/Kreedit (D/C)": "direction",
  "Debit/Credit (D/C)": "direction",
};

/** "15.00" | "1 234,56" | "-15.00" → cents. */
export function parseAmountToCents(raw: string): number {
  const cleaned = raw.replace(/\s| /g, "").replace(",", ".").trim();
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) {
    throw new Error(`Unparseable amount: ${JSON.stringify(raw)}`);
  }
  return Math.round(value * 100);
}

/**
 * Parse an LHV account-statement CSV. Accepts the Estonian export (canonical)
 * and the English export. Returns every row (debits included) — the matcher
 * filters to credits.
 */
export function parseLhvCsv(input: string | Buffer): BankTransaction[] {
  const rows: Record<string, string>[] = parse(input, {
    columns: true,
    bom: true,
    skipEmptyLines: true,
    relaxColumnCount: true,
    // accept LF / CRLF / CR and a hand-edited file with mixed endings
    recordDelimiter: ["\n", "\r\n", "\r"],
    trim: true,
  });

  if (rows.length > 0) {
    const headers = new Set(
      Object.keys(rows[0]).map((h) => HEADER_ALIASES[h.trim()]),
    );
    for (const required of [
      "date",
      "amountCents",
      "archivingCode",
      "direction",
    ] as const) {
      if (!headers.has(required)) {
        throw new Error(
          `CSV is missing a required column (${required}) — is this an LHV account statement?`,
        );
      }
    }
  }

  return rows.map((row) => {
    const txn: BankTransaction = {
      date: "",
      amountCents: 0,
      archivingCode: "",
      description: "",
      idOrRegCode: "",
      counterpartyAccount: "",
      counterpartyName: "",
      direction: "",
    };

    for (const [header, rawValue] of Object.entries(row)) {
      const field = HEADER_ALIASES[header.trim()];
      if (!field || field === "ignore") continue;
      const value = (rawValue ?? "").trim();
      if (field === "amountCents") {
        txn.amountCents = value ? parseAmountToCents(value) : 0;
      } else if (field === "direction") {
        txn.direction = value === "C" || value === "D" ? value : "";
      } else if (field === "date") {
        txn.date = value.slice(0, 10);
      } else {
        txn[field] = value;
      }
    }

    // Bank-generated lines (e.g. "Saadud intress") have no counterparty and no
    // archiving code. Keep them — the matcher ignores rows without a code.
    return txn;
  });
}

// ─── Matching ────────────────────────────────────────────────────────────────

const SELGITUS_DONATION_ID = /Anneta Targalt annetus (\d+)/;

/** Donation id embedded by Montonio in the payment reference, if present. */
export function parseSelgitusDonationId(description: string): number | null {
  const match = SELGITUS_DONATION_ID.exec(description);
  return match ? Number(match[1]) : null;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * A transaction date may lag the donation date (bank settles later), never
 * precede it. `0 <= txnDate - donationDate <= maxDays`.
 */
function withinDateWindow(
  txn: BankTransaction,
  donation: ReconcilableDonation,
  maxDays: number,
): boolean {
  const diff = daysBetween(donation.datetime, txn.date);
  return diff >= 0 && diff <= maxDays;
}

function idOrCompanyMatches(
  txn: BankTransaction,
  donation: ReconcilableDonation,
): boolean {
  if (donation.donorIdCode && txn.idOrRegCode === donation.donorIdCode) {
    return true;
  }
  if (donation.companyCode && txn.idOrRegCode === donation.companyCode) {
    return true;
  }
  return false;
}

export interface MatchOptions {
  /** date-window width for the id-code strategy (default 4, as in the script) */
  maxDateWindowDays?: number;
}

/**
 * Match each donation against the transactions. Strategy order, first hit wins:
 *
 *  1. `manual`            — an entry in `overrides` (donationId → archivingCode)
 *  2. `selgitus-id`       — a credit whose Selgitus carries this donation's id
 *                           and whose amount equals the donation's
 *  3. `idcode-amount-date`— exactly one credit with matching id/reg code,
 *                           equal amount, and date within the window
 *
 * More than one candidate in step 3 ⇒ `ambiguous`. None ⇒ transactionless.
 */
export function matchDonations(
  transactions: BankTransaction[],
  donations: ReconcilableDonation[],
  overrides: Map<number, string> = new Map(),
  options: MatchOptions = {},
): ReconciliationReport {
  const maxDays = options.maxDateWindowDays ?? 4;
  const credits = transactions.filter(
    (t) => t.direction === "C" && t.archivingCode !== "",
  );
  const codeExists = new Set(credits.map((t) => t.archivingCode));

  const matched: ReconciliationReport["matched"] = [];
  const ambiguous: ReconciliationReport["ambiguous"] = [];
  const transactionlessDonations: number[] = [];
  const claimedCodes = new Set<string>();

  for (const donation of donations) {
    const override = overrides.get(donation.id);
    if (override !== undefined) {
      matched.push({
        donationId: donation.id,
        archivingCode: override,
        source: "manual",
      });
      if (codeExists.has(override)) claimedCodes.add(override);
      continue;
    }

    const selgitusHit = credits.find(
      (t) =>
        parseSelgitusDonationId(t.description) === donation.id &&
        t.amountCents === donation.amountCents,
    );
    if (selgitusHit) {
      matched.push({
        donationId: donation.id,
        archivingCode: selgitusHit.archivingCode,
        source: "selgitus-id",
      });
      claimedCodes.add(selgitusHit.archivingCode);
      continue;
    }

    const idHits = credits.filter(
      (t) =>
        t.amountCents === donation.amountCents &&
        idOrCompanyMatches(t, donation) &&
        withinDateWindow(t, donation, maxDays),
    );
    const candidateCodes = [...new Set(idHits.map((t) => t.archivingCode))];

    if (candidateCodes.length === 1) {
      matched.push({
        donationId: donation.id,
        archivingCode: candidateCodes[0],
        source: "idcode-amount-date",
      });
      claimedCodes.add(candidateCodes[0]);
    } else if (candidateCodes.length > 1) {
      ambiguous.push({ donationId: donation.id, candidateCodes });
    } else {
      transactionlessDonations.push(donation.id);
    }
  }

  const donationlessTransactions = credits.filter(
    (t) => !claimedCodes.has(t.archivingCode),
  );

  return {
    matched,
    ambiguous,
    donationlessTransactions,
    transactionlessDonations,
  };
}
