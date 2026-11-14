import { describe, it, expect } from "vitest";
import { preferenceChanges, unsubscribing } from "../email-preferences";

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

describe("the changes a request asks for", () => {
  it("takes the settings it has, the language as a locale or null", () => {
    expect(preferenceChanges({ newsletter: false, emailLocale: "en" })).toEqual(
      { changes: { newsletter: false, emailLocale: "en" } },
    );
    expect(preferenceChanges({ emailLocale: null })).toEqual({
      changes: { emailLocale: null },
    });
    expect(preferenceChanges({})).toEqual({ changes: {} });
  });

  it("refuses a language the site doesn't have", () => {
    expect(preferenceChanges({ emailLocale: "fi" })).toHaveProperty("error");
    expect(preferenceChanges({ emailLocale: "" })).toHaveProperty("error");
  });

  it("refuses a setting that isn't true or false", () => {
    expect(preferenceChanges({ yearlyEmails: "no" })).toHaveProperty("error");
  });
});
