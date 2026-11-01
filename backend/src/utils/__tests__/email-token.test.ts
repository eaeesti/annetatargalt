import { describe, it, expect } from "vitest";
import { donorIdFromToken, emailPreferencesToken } from "../email-token";

const SECRET = "a secret";

describe("email preferences tokens", () => {
  it("reads back the donor a token was made for", () => {
    expect(donorIdFromToken(emailPreferencesToken(42, SECRET), SECRET)).toBe(
      42,
    );
  });

  it("rejects a token for another donor's id", () => {
    const [, signature] = emailPreferencesToken(42, SECRET).split(".");
    expect(donorIdFromToken(`43.${signature}`, SECRET)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    expect(
      donorIdFromToken(emailPreferencesToken(42, "another"), SECRET),
    ).toBeNull();
  });

  it("rejects anything that isn't a token", () => {
    for (const value of [undefined, 42, "", "42", "42.", "x.y", ["42.a"]]) {
      expect(donorIdFromToken(value, SECRET)).toBeNull();
    }
  });
});
