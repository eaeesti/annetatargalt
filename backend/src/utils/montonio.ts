import jwt from "jsonwebtoken";

const montonioUrl = process.env.MONTONIO_URL;

export interface MontonioPayload {
  amount: number;
  currency: string;
  merchant_reference: string;
  merchant_return_url: string;
  merchant_notification_url: string;
  payment_information_unstructured?: string;
  [key: string]: any;
}

export interface MontonioDecodedToken extends MontonioPayload {
  accessKey: string;
  iat: number;
  exp: number;
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
    const token = jwt.sign(payloadWithKey, process.env.MONTONIO_PRIVATE!, {
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
      process.env.MONTONIO_PRIVATE!
    ) as MontonioDecodedToken;

    if (decoded.accessKey === process.env.MONTONIO_PUBLIC) {
      return decoded;
    } else {
      throw new Error("Invalid public key");
    }
  },
};

export default montonio;
