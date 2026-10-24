import jwt from "jsonwebtoken";
import { isRecord } from "./narrow";

const montonioUrl = process.env.MONTONIO_URL;

export interface MontonioPayload {
  [key: string]: unknown;
}

export interface MontonioDecodedToken {
  accessKey: string;
  iat?: number | null;
  exp?: number | null;
  paymentStatus?: string | null;
  merchant_reference?: string | null;
  // a card payment has no IBAN
  customer_iban?: string | null;
  payment_method_name?: string | null;
  [key: string]: unknown;
}

function getPrivateKey(): string {
  const key = process.env.MONTONIO_PRIVATE;
  if (!key) throw new Error("MONTONIO_PRIVATE environment variable is not set");
  return key;
}

function getPublicKey(): string {
  const key = process.env.MONTONIO_PUBLIC;
  if (!key) throw new Error("MONTONIO_PUBLIC environment variable is not set");
  return key;
}

const montonio = {
  /**
   * Fetch a payment redirect URL from Montonio API.
   */
  fetchRedirectUrl: async (payload: MontonioPayload): Promise<string> => {
    const token = montonio.createOrderToken(payload);
    const url = `${montonioUrl}/orders`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: token }),
      });
      const data: unknown = await response.json();
      if (!isRecord(data) || typeof data.paymentUrl !== "string") {
        throw new Error("No payment URL in Montonio's reply");
      }
      return data.paymentUrl;
    } catch {
      throw new Error("Failed to fetch redirect URL");
    }
  },

  /**
   * Create a JWT order token for Montonio.
   */
  createOrderToken: (payload: MontonioPayload): string => {
    const payloadWithKey = {
      accessKey: getPublicKey(),
      ...payload,
    };
    const token = jwt.sign(payloadWithKey, getPrivateKey(), {
      algorithm: "HS256",
      expiresIn: "10m",
    });
    return token;
  },

  /**
   * Decode and verify a Montonio order token.
   */
  decodeOrderToken: (orderToken: string): MontonioDecodedToken => {
    const decoded = jwt.verify(orderToken, getPrivateKey());
    if (!isDecodedToken(decoded)) {
      throw new Error("Invalid order token");
    }
    if (decoded.accessKey !== getPublicKey()) {
      throw new Error("Invalid public key");
    }
    return decoded;
  },

  // ─── Payouts (statement reconciliation) ────────────────────────────────────
  //
  // GET {MONTONIO_URL}/stores/:storeUuid/payouts            → list payouts
  // GET .../payouts/:payoutUuid/export-json                 → { url } to the
  //                                                           order list file
  //
  // Auth: a JWT signed with the secret key, sent as `Authorization: Bearer`.
  // Requires MONTONIO_STORE_UUID. All calls fail soft (return null) so the
  // statement UI falls back to manual entry.

  isPayoutsConfigured: (): boolean =>
    Boolean(process.env.MONTONIO_STORE_UUID && montonioUrl),

  createAuthToken: (): string =>
    jwt.sign({ accessKey: getPublicKey() }, getPrivateKey(), {
      algorithm: "HS256",
      expiresIn: "10m",
    }),

  /**
   * Recent payouts, newest first. `[]` on any failure.
   */
  listPayouts: async (limit = 149): Promise<MontonioPayout[]> => {
    if (!montonio.isPayoutsConfigured()) return [];
    const storeUuid = process.env.MONTONIO_STORE_UUID;
    try {
      const res = await fetch(
        `${montonioUrl}/stores/${storeUuid}/payouts?limit=${limit}&offset=0&order=DESC`,
        { headers: { Authorization: `Bearer ${montonio.createAuthToken()}` } },
      );
      if (!res.ok) return [];
      const body: unknown = await res.json();
      const listed = Array.isArray(body)
        ? body
        : isRecord(body)
          ? (body.payouts ?? body.data)
          : undefined;
      const rows = Array.isArray(listed) ? listed.filter(isPayout) : [];
      // Montonio ignores `order=DESC`; sort newest-first ourselves.
      return rows.sort(
        (a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""),
      );
    } catch {
      return [];
    }
  },

  /**
   * The order list for one payout → merchant references. `null` on any failure
   * (caller should fall back to manual reconciliation).
   */
  getPayoutOrders: async (
    payoutUuid: string,
  ): Promise<MontonioPayoutOrder[] | null> => {
    if (!montonio.isPayoutsConfigured()) return null;
    const storeUuid = process.env.MONTONIO_STORE_UUID;
    try {
      const res = await fetch(
        `${montonioUrl}/stores/${storeUuid}/payouts/${payoutUuid}/export-json`,
        { headers: { Authorization: `Bearer ${montonio.createAuthToken()}` } },
      );
      if (!res.ok) return null;
      const first: unknown = await res.json();
      // Response is either the rows directly or a URL to a JSON file of rows.
      if (Array.isArray(first)) return ordersIn(first);
      if (!isRecord(first) || typeof first.url !== "string" || !first.url) {
        return null;
      }
      const fileRes = await fetch(first.url);
      if (!fileRes.ok) return null;
      const rows: unknown = await fileRes.json();
      return ordersIn(
        Array.isArray(rows) ? rows : isRecord(rows) ? rows.orders : undefined,
      );
    } catch {
      return null;
    }
  },
};

export interface MontonioPayout {
  uuid: string;
  status?: string | null;
  currency?: string | null;
  settlementType?: string | null;
  /** major units, e.g. "673.10" — Montonio calls this `totalAmount` */
  totalAmount?: string | number | null;
  createdAt?: string | null;
  [key: string]: unknown;
}

export interface MontonioPayoutOrder {
  merchantReference?: string | null;
  merchant_reference?: string | null;
  /** order gross — Montonio's exact key varies by export version */
  grandTotal?: string | number | null;
  grand_total?: string | number | null;
  amount?: string | number | null;
  total?: string | number | null;
  [key: string]: unknown;
}

// Montonio leaves a field out or sends null when it has no value.
const isOptional = (value: unknown, type: "string" | "number") =>
  value === undefined || value === null || typeof value === type;
const isOptionalAmount = (value: unknown) =>
  value === undefined ||
  value === null ||
  typeof value === "string" ||
  typeof value === "number";

function isDecodedToken(value: unknown): value is MontonioDecodedToken {
  return (
    isRecord(value) &&
    typeof value.accessKey === "string" &&
    isOptional(value.iat, "number") &&
    isOptional(value.exp, "number") &&
    isOptional(value.paymentStatus, "string") &&
    isOptional(value.merchant_reference, "string") &&
    isOptional(value.customer_iban, "string") &&
    isOptional(value.payment_method_name, "string")
  );
}

function isPayout(value: unknown): value is MontonioPayout {
  return (
    isRecord(value) &&
    typeof value.uuid === "string" &&
    isOptional(value.status, "string") &&
    isOptional(value.currency, "string") &&
    isOptional(value.settlementType, "string") &&
    isOptionalAmount(value.totalAmount) &&
    isOptional(value.createdAt, "string")
  );
}

function isPayoutOrder(value: unknown): value is MontonioPayoutOrder {
  return (
    isRecord(value) &&
    isOptional(value.merchantReference, "string") &&
    isOptional(value.merchant_reference, "string") &&
    isOptionalAmount(value.grandTotal) &&
    isOptionalAmount(value.grand_total) &&
    isOptionalAmount(value.amount) &&
    isOptionalAmount(value.total)
  );
}

/**
 * A payout's orders, or null when the list isn't one: a payout's fee is
 * worked out from all of its orders, so one unreadable order makes the whole
 * list unusable rather than quietly left out.
 */
function ordersIn(list: unknown): MontonioPayoutOrder[] | null {
  return Array.isArray(list) && list.every(isPayoutOrder) ? list : null;
}

export default montonio;
