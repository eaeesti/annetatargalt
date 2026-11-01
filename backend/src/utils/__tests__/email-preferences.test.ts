import { describe, it, expect } from "vitest";
import { unsubscribing } from "../email-preferences";

describe("a mail client's unsubscribe button", () => {
  it("stops the kind of email it was in", () => {
    expect(unsubscribing("transfer")).toEqual({ transferEmails: false });
  });

  it("stops every kind there is, from a confirmation", () => {
    expect(unsubscribing("all")).toEqual({
      newsletter: false,
      transferEmails: false,
      yearlyEmails: false,
    });
  });
});
