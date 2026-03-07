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
      accessKey: process.env.MONTONIO_PUBLIC,
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
    const decoded = jwt.verify(orderToken, getPrivateKey()) as MontonioDecodedToken;

    if (decoded.accessKey === process.env.MONTONIO_PUBLIC) {
      return decoded;
    } else {
      throw new Error("Invalid public key");
    }
  },
};

export default montonio;
