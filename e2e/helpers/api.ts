import { URLS } from "../stack/config.ts";
import { isRecord } from "./narrow.ts";
import { ORGS } from "../stack/content.ts";
import { orders } from "./fakes.ts";

export interface ApiDonation {
  firstName: string;
  lastName: string;
  email: string;
  idCode?: string;
  /** In euros. */
  amount: number;
  type?: "onetime" | "recurring";
  /** For a monthly donation: "other" has no standing order link. */
  bank?: string;
  companyName?: string;
  companyCode?: string;
}

/**
 * A donation made the way the site's form makes one, all to one
 * organization; a one-off one is then paid at the fake bank. Returns the
 * one-off donation's id (null for a monthly one, which is paid later).
 */
export async function donate(
  donation: ApiDonation,
  org: keyof typeof ORGS = "alpha",
): Promise<number | null> {
  const cents = Math.round(donation.amount * 100);
  const response = await fetch(`${URLS.backend}/api/donate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "onetime",
      paymentMethod: "paymentInitiation",
      locale: "et",
      newsletter: true,
      ...donation,
      amount: cents,
      amounts: [
        { organizationInternalId: ORGS[org].internalId, amount: cents },
      ],
    }),
  });
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body)) {
    throw new Error(`The donation was refused: ${JSON.stringify(body)}`);
  }
  if (donation.type === "recurring") return null;

  const paymentUrl = String(body.redirectURL);
  const orderId = Number(paymentUrl.split("/").pop());
  // As the bank page's button does; the fake tells the backend at once.
  const paid = await fetch(`${paymentUrl}/PAID`, {
    method: "POST",
    redirect: "manual",
  });
  if (paid.status !== 303) {
    throw new Error(`The payment wasn't accepted: ${await paid.text()}`);
  }
  const order = (await orders()).find((o) => o.id === orderId);
  const id = Number(order?.merchantReference.split(" ").pop());
  if (!Number.isInteger(id)) throw new Error(`No donation for ${paymentUrl}`);
  return id;
}

const random = (below: number) => Math.floor(Math.random() * below);
const pad = (n: number, width: number) => String(n).padStart(width, "0");

/**
 * A valid Estonian ID code nobody else in the run has, so that a bank line
 * from it matches only this test's donor.
 */
export function idCode(): string {
  const base = [
    3 + random(2),
    pad(50 + random(50), 2),
    pad(1 + random(12), 2),
    pad(1 + random(28), 2),
    pad(random(1000), 3),
  ].join("");
  const digits = [...base].map(Number);
  const check = (weights: number[]) =>
    digits.reduce((sum, d, i) => sum + d * weights[i], 0) % 11;
  let last = check([1, 2, 3, 4, 5, 6, 7, 8, 9, 1]);
  if (last === 10) last = check([3, 4, 5, 6, 7, 8, 9, 1, 2, 3]) % 10;
  return `${base}${last}`;
}
