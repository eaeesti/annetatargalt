import { describe, it, expect, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import montonio from "../montonio";

const SECRET = "test-secret";
const ACCESS_KEY = "test-access-key";

const sign = (payload: object) =>
  jwt.sign(payload, SECRET, { algorithm: "HS256" });

describe("decodeOrderToken", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.MONTONIO_PRIVATE = SECRET;
    process.env.MONTONIO_PUBLIC = ACCESS_KEY;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("accepts a paid card payment, which has no IBAN", () => {
    const decoded = montonio.decodeOrderToken(
      sign({
        accessKey: ACCESS_KEY,
        paymentStatus: "PAID",
        merchant_reference: "Anneta Targalt 12",
        customer_iban: null,
        payment_method_name: "Card",
      }),
    );
    expect(decoded.paymentStatus).toBe("PAID");
    expect(decoded.merchant_reference).toBe("Anneta Targalt 12");
    expect(decoded.customer_iban).toBeNull();
  });

  it("accepts a token that leaves the optional fields out", () => {
    const decoded = montonio.decodeOrderToken(sign({ accessKey: ACCESS_KEY }));
    expect(decoded.accessKey).toBe(ACCESS_KEY);
  });

  it("refuses a token made for another store", () => {
    expect(() =>
      montonio.decodeOrderToken(sign({ accessKey: "someone-else" })),
    ).toThrow("Invalid public key");
  });

  it("refuses a token whose reference isn't text", () => {
    expect(() =>
      montonio.decodeOrderToken(
        sign({ accessKey: ACCESS_KEY, merchant_reference: { id: 12 } }),
      ),
    ).toThrow("Invalid order token");
  });

  it("refuses a token signed with another secret", () => {
    const forged = jwt.sign({ accessKey: ACCESS_KEY }, "other-secret", {
      algorithm: "HS256",
    });
    expect(() => montonio.decodeOrderToken(forged)).toThrow();
  });
});
