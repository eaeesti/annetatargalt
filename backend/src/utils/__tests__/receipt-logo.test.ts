import { describe, it, expect, vi } from "vitest";
import type { Core } from "@strapi/strapi";
import { sendEmail } from "../../emails";
import type { EmailRecipient } from "../../strapi-internals";

describe("a receipt", () => {
  it("goes out without the logo when the logo can't be read", async () => {
    const sendTemplatedEmail = vi.fn(async () => {});
    const error = vi.fn();
    // oxlint-disable-next-line typescript/consistent-type-assertions
    const strapi = {
      documents: () => ({
        findFirst: async () => {
          throw new Error("Connection reset");
        },
      }),
      plugin: () => ({ service: () => ({ sendTemplatedEmail }) }),
      log: { error },
    } as unknown as Core.Strapi;

    await sendEmail(strapi, {
      recipient: { to: "mari@example.org" },
      template: { subject: "Aitäh", text: "Aitäh!", html: "<p>Aitäh!</p>" },
      data: {},
      locale: "et",
      emailConfig: {},
      donorId: null,
    });

    expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Connection reset"),
    );
  });

  // Without one of ours, Brevo adds its own, whose one click stops every
  // email to the address, receipts included, without us knowing.
  describe("has an unsubscribe button", () => {
    async function headersOf(donorId: number | null) {
      const sendTemplatedEmail = vi.fn(
        async (_recipient: EmailRecipient) => {},
      );
      // oxlint-disable-next-line typescript/consistent-type-assertions
      const strapi = {
        documents: () => ({ findFirst: async () => null }),
        plugin: () => ({ service: () => ({ sendTemplatedEmail }) }),
        config: { get: () => ["test-key"] },
        log: { error: vi.fn() },
      } as unknown as Core.Strapi;
      await sendEmail(strapi, {
        recipient: { to: "mari@example.org" },
        template: { subject: "Aitäh", text: "Aitäh!", html: "<p>Aitäh!</p>" },
        data: {},
        locale: "et",
        emailConfig: {},
        donorId,
      });
      return sendTemplatedEmail.mock.calls[0]?.[0].headers;
    }

    it("that stops every email a donor can turn off, but not the receipts", async () => {
      expect(await headersOf(7)).toEqual({
        "List-Unsubscribe": expect.stringMatching(
          /\/api\/unsubscribe\?token=7\.[\w-]{22}&kind=all&locale=et>$/,
        ),
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      });
    });

    it("that stops nothing for someone else, opening the page for choosing emails", async () => {
      expect(await headersOf(null)).toEqual({
        "List-Unsubscribe": expect.stringMatching(
          /\/api\/email-settings\?locale=et>$/,
        ),
      });
    });
  });
});
