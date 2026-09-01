import jwt from "jsonwebtoken";

const montonioUrl = process.env.MONTONIO_URL;

export interface MontonioPayload {
  [key: string]: unknown;
}

export interface MontonioDecodedToken {
  accessKey: string;
  iat: number;
  exp: number;
  paymentStatus?: string;
  merchant_reference?: string;
  customer_iban?: string;
  payment_method_name?: string;
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
      const data = (await response.json()) as { paymentUrl: string };
      return data.paymentUrl;
    } catch (error) {
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
    const decoded = jwt.verify(
      orderToken,
      getPrivateKey(),
    ) as MontonioDecodedToken;

    if (decoded.accessKey === getPublicKey()) {
      return decoded;
    } else {
      throw new Error("Invalid public key");
    }
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
  listPayouts: async (limit = 50): Promise<MontonioPayout[]> => {
    if (!montonio.isPayoutsConfigured()) return [];
    const storeUuid = process.env.MONTONIO_STORE_UUID;
    try {
      const res = await fetch(
        `${montonioUrl}/stores/${storeUuid}/payouts?limit=${limit}&offset=0&order=DESC`,
        { headers: { Authorization: `Bearer ${montonio.createAuthToken()}` } },
      );
      if (!res.ok) return [];
      const body = (await res.json()) as
        | MontonioPayout[]
        | { data?: MontonioPayout[] };
      return Array.isArray(body) ? body : (body.data ?? []);
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
      const first = (await res.json()) as
        | { url?: string }
        | MontonioPayoutOrder[];
      // Response is either the rows directly or a URL to a JSON file of rows.
      if (Array.isArray(first)) return first;
      if (!first.url) return null;
      const fileRes = await fetch(first.url);
      if (!fileRes.ok) return null;
      const rows = (await fileRes.json()) as
        | MontonioPayoutOrder[]
        | { orders?: MontonioPayoutOrder[] };
      return Array.isArray(rows) ? rows : (rows.orders ?? null);
    } catch {
      return null;
    }
  },
};

export interface MontonioPayout {
  uuid: string;
  status?: string;
  currency?: string;
  /** major units, e.g. "673.10" */
  amount?: string | number;
  createdAt?: string;
  [key: string]: unknown;
}

export interface MontonioPayoutOrder {
  merchantReference?: string;
  merchant_reference?: string;
  grandTotal?: string | number;
  [key: string]: unknown;
}

export default montonio;
