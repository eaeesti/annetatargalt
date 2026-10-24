import { isRecord } from "./object";
import Proportions from "./proportions";
import type { ProportionEntry, ProportionKey } from "./proportions";

/** What a visitor has entered in the donation form. */
export interface DonationState {
  amount: number;
  type: string;
  firstName: string;
  lastName: string;
  email: string;
  idCode: string;
  bank: string;
  companyDonation: boolean;
  companyName: string;
  companyCode: string;
  dedicateDonation: boolean;
  dedicationName: string;
  dedicationEmail: string;
  dedicationMessage: string;
  proportions: Proportions;
  addTip: boolean;
  paymentMethod: string;
  acceptTerms: boolean;
}

/**
 * The donation form as the visitor left it, kept in the browser tab so that a
 * refresh, a look at another page or a payment cancelled at the bank doesn't
 * lose it. It's the tab's storage, not the browser's: closing the tab forgets
 * the name, email and ID code instead of leaving them on a shared computer.
 */
export interface DonationDraft {
  stage: number;
  donation: DonationState;
}

const DRAFT_KEY = "donationDraft";

/** How a cause's or organization's share of the split is kept. */
interface KeptShare {
  proportion: number;
  locked: boolean;
  toFund?: boolean;
  proportions?: Record<string, KeptShare>;
}

function keptShares(proportions: Proportions): Record<string, KeptShare> {
  return Object.fromEntries(
    proportions
      .entries()
      .map(([key, { proportion, locked, toFund, proportions: subs }]) => [
        key,
        {
          proportion,
          locked,
          toFund,
          proportions: subs && keptShares(subs),
        },
      ]),
  );
}

/**
 * The kept split laid over the causes and organizations on the site now, or
 * null if they have changed since: then the kept split doesn't fit them.
 */
function restoreShares(
  kept: unknown,
  current: Proportions,
): Proportions | null {
  if (!isRecord(kept) || Object.keys(kept).length !== current.keys().length) {
    return null;
  }

  const entries: Array<[ProportionKey, ProportionEntry]> = [];
  for (const [key, entry] of current.entries()) {
    const share = kept[String(key)];
    if (
      !isRecord(share) ||
      typeof share.proportion !== "number" ||
      typeof share.locked !== "boolean"
    ) {
      return null;
    }

    let toFund = entry.toFund;
    if (typeof toFund === "boolean") {
      if (typeof share.toFund !== "boolean") return null;
      toFund = share.toFund;
    }

    let proportions = entry.proportions;
    if (proportions) {
      const restored = restoreShares(share.proportions, proportions);
      if (!restored) return null;
      proportions = restored;
    }

    entries.push([
      key,
      {
        ...entry,
        proportion: share.proportion,
        locked: share.locked,
        toFund,
        proportions,
      },
    ]);
  }
  return new Proportions(entries);
}

/** The kept fields other than the split, or null if any is missing or off. */
function restoreFields(
  kept: Record<string, unknown>,
): Omit<DonationState, "proportions" | "acceptTerms"> | null {
  const {
    amount,
    type,
    firstName,
    lastName,
    email,
    idCode,
    bank,
    companyDonation,
    companyName,
    companyCode,
    dedicateDonation,
    dedicationName,
    dedicationEmail,
    dedicationMessage,
    addTip,
    paymentMethod,
  } = kept;

  if (
    typeof amount !== "number" ||
    !(amount > 0) ||
    (type !== "recurring" && type !== "onetime") ||
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof email !== "string" ||
    typeof idCode !== "string" ||
    typeof bank !== "string" ||
    typeof companyDonation !== "boolean" ||
    typeof companyName !== "string" ||
    typeof companyCode !== "string" ||
    typeof dedicateDonation !== "boolean" ||
    typeof dedicationName !== "string" ||
    typeof dedicationEmail !== "string" ||
    typeof dedicationMessage !== "string" ||
    typeof addTip !== "boolean" ||
    (paymentMethod !== "paymentInitiation" && paymentMethod !== "cardPayments")
  ) {
    return null;
  }

  return {
    amount,
    type,
    firstName,
    lastName,
    email,
    idCode,
    bank,
    companyDonation,
    companyName,
    companyCode,
    dedicateDonation,
    dedicationName,
    dedicationEmail,
    dedicationMessage,
    addTip,
    paymentMethod,
  };
}

/** One of the form's four steps. */
function isStage(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < 4;
}

/**
 * The draft as it's kept. `link` is the choices of the link the form was
 * opened with: a link with other choices starts afresh.
 */
export function donationDraftJson(
  link: string,
  stage: number,
  donation: DonationState,
): string {
  return JSON.stringify({
    link,
    stage,
    donation: {
      ...donation,
      proportions: keptShares(donation.proportions),
      // agreeing to the terms is for each donation anew
      acceptTerms: undefined,
    },
  });
}

/**
 * The draft kept for the form of this link, checked against what the site
 * offers now, or null if there's none or it doesn't fit. `current` is the
 * form's split before any choices, and the banks it lists.
 */
export function parseDonationDraft(
  json: string | null,
  link: string,
  current: { proportions: Proportions; banks: Array<string | null> },
): DonationDraft | null {
  let draft: unknown;
  try {
    draft = JSON.parse(json ?? "null");
  } catch {
    return null;
  }
  if (!isRecord(draft) || draft.link !== link || !isRecord(draft.donation)) {
    return null;
  }

  const { stage } = draft;
  const fields = restoreFields(draft.donation);
  if (!isStage(stage) || !fields) return null;

  const proportions = restoreShares(
    draft.donation.proportions,
    current.proportions,
  );
  const bankListed =
    fields.bank === "other" || current.banks.includes(fields.bank);

  return {
    // with other organizations on the site, back to where they're chosen
    stage: proportions ? stage : 0,
    donation: {
      ...fields,
      bank: bankListed ? fields.bank : "",
      proportions: proportions ?? current.proportions,
      acceptTerms: false,
    },
  };
}

// The tab's storage can be switched off or full. The form then works as it
// would without a draft.

export function loadDonationDraft(): string | null {
  try {
    return sessionStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

export function saveDonationDraft(json: string): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, json);
  } catch {
    // kept no draft
  }
}

/** Forgets the draft, once its donation is made. */
export function clearDonationDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // there was none to forget
  }
}
