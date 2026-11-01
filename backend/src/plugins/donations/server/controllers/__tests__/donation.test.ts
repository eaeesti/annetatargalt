import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "koa";

const repository = vi.hoisted(() => ({
  findById: vi.fn(),
  finalize: vi.fn(),
  recordPaymentStatus: vi.fn(),
}));
const decodeOrderToken = vi.hoisted(() => vi.fn());

vi.mock("../../../../../db/repositories/donations.repository", () => ({
  DonationsRepository: class {
    findById = repository.findById;
    finalize = repository.finalize;
    recordPaymentStatus = repository.recordPaymentStatus;
  },
}));
vi.mock("../../../../../utils/montonio", () => ({
  default: { decodeOrderToken },
}));

const { default: controllerFactory } = await import("../donation");

// Both of the plugin's services the handler uses, the donation's and the donor's
const service = {
  applyNewsletterChoice: vi.fn(),
  createDonation: vi.fn(async () => ({ redirectURL: "https://pay.example" })),
  createForeignDonation: vi.fn(async () => ({
    redirectURL: "https://pay.example",
  })),
  sendConfirmationEmail: vi.fn(),
  sendExternalConfirmationEmail: vi.fn(),
  sendDedicationEmail: vi.fn(),
};
const log = { error: vi.fn(), info: vi.fn() };
const fakeStrapi = {
  plugin: () => ({ service: () => service }),
  log,
};
const controller = controllerFactory({ strapi: fakeStrapi });

/** Montonio's notification that a payment went through. */
function notification() {
  // A test double for Koa's context, which can't be built whole in a test.
  // oxlint-disable-next-line typescript/consistent-type-assertions
  return {
    request: { query: { "order-token": "token" } },
    send: vi.fn((data: unknown, status?: number) => ({ data, status })),
    badRequest: vi.fn((message: string) => ({ badRequest: message })),
  } as unknown as Context;
}

describe("payment confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    decodeOrderToken.mockReturnValue({
      paymentStatus: "PAID",
      merchant_reference: "Donation 7",
      customer_iban: "EE000000000000000001",
      payment_method_name: "Test bank",
    });
    repository.findById.mockResolvedValue({
      id: 7,
      finalized: false,
      externalDonation: false,
      dedicationEmail: null,
    });
    repository.finalize.mockResolvedValue({
      id: 7,
      donorId: 3,
      finalized: true,
      newsletter: true,
    });
    repository.recordPaymentStatus.mockResolvedValue(undefined);
    for (const send of Object.values(service)) {
      send.mockResolvedValue(undefined);
    }
  });

  it("finalizes the donation with the payment's details and sends its receipt", async () => {
    const result = await controller.confirm(notification());

    expect(result).toEqual({ data: null, status: 204 });
    expect(repository.finalize).toHaveBeenCalledWith(7, {
      iban: "EE000000000000000001",
      paymentMethod: "Test bank",
    });
    expect(service.sendConfirmationEmail).toHaveBeenCalledOnce();
    expect(service.sendConfirmationEmail).toHaveBeenCalledWith(7);
    expect(service.sendDedicationEmail).not.toHaveBeenCalled();
  });

  it("records a payment the donor abandoned, and answers it as received", async () => {
    decodeOrderToken.mockReturnValue({
      paymentStatus: "ABANDONED",
      merchant_reference: "Donation 7",
    });

    const result = await controller.confirm(notification());

    expect(result).toEqual({ data: null, status: 204 });
    expect(repository.finalize).not.toHaveBeenCalled();
    expect(repository.recordPaymentStatus).toHaveBeenCalledWith(7, "ABANDONED");
    expect(service.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith(
      "Donation 7: Montonio reports ABANDONED",
    );
  });

  it("answers the report as received even when it can't be recorded", async () => {
    decodeOrderToken.mockReturnValue({
      paymentStatus: "ABANDONED",
      merchant_reference: "Donation 7",
    });
    repository.recordPaymentStatus.mockRejectedValue(new Error("DB is down"));

    const result = await controller.confirm(notification());

    expect(result).toEqual({ data: null, status: 204 });
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("DB is down"),
    );
  });

  it("answers a repeated notification as done, without sending anything again", async () => {
    repository.finalize.mockResolvedValue(undefined);

    const result = await controller.confirm(notification());

    expect(result).toEqual({ data: null, status: 204 });
    expect(service.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(service.sendDedicationEmail).not.toHaveBeenCalled();
    expect(service.applyNewsletterChoice).not.toHaveBeenCalled();
  });

  it("applies the newsletter choice made with the donation, now that it's paid", async () => {
    await controller.confirm(notification());

    expect(service.applyNewsletterChoice).toHaveBeenCalledWith(3, true);
  });

  it("leaves a no alone when it's paid: it counted when the donation was made", async () => {
    repository.finalize.mockResolvedValue({
      id: 7,
      donorId: 3,
      finalized: true,
      newsletter: false,
    });

    await controller.confirm(notification());

    expect(service.applyNewsletterChoice).not.toHaveBeenCalled();
  });

  it("still sends the receipt when the newsletter choice can't be applied", async () => {
    service.applyNewsletterChoice.mockRejectedValue(new Error("DB is down"));

    const result = await controller.confirm(notification());

    expect(result).toEqual({ data: null, status: 204 });
    expect(service.sendConfirmationEmail).toHaveBeenCalledWith(7);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("DB is down"),
    );
  });

  it("still sends the dedication email, and answers as done, when the receipt fails", async () => {
    repository.findById.mockResolvedValue({
      id: 7,
      finalized: false,
      externalDonation: false,
      dedicationEmail: "friend@example.org",
    });
    service.sendConfirmationEmail.mockRejectedValue(new Error("SMTP is down"));

    const result = await controller.confirm(notification());

    expect(result).toEqual({ data: null, status: 204 });
    expect(service.sendDedicationEmail).toHaveBeenCalledWith(7);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("SMTP is down"),
    );
  });
});

describe("one-off donations from one address", () => {
  beforeEach(() => {
    service.createDonation.mockResolvedValue({
      redirectURL: "https://pay.example",
    });
    service.createForeignDonation.mockResolvedValue({
      redirectURL: "https://pay.example",
    });
  });

  /** A donation form's request from `ip`. */
  function donating(ip: string, type = "onetime") {
    // oxlint-disable-next-line typescript/consistent-type-assertions
    return {
      request: { ip, body: { type, email: "test@example.org" } },
      send: vi.fn((data: unknown, status?: number) => ({ data, status })),
      badRequest: vi.fn((message: string) => ({ badRequest: message })),
    } as unknown as Context;
  }

  it("are turned away after twenty in an hour", async () => {
    const answers = [];
    for (let i = 0; i < 21; i++) {
      answers.push(await controller.donate(donating("203.0.113.1")));
    }

    expect(
      answers
        .slice(0, 20)
        .every((a) => a.data?.redirectURL === "https://pay.example"),
    ).toBe(true);
    expect(answers[20]).toMatchObject({ status: 429 });
    // Another address isn't
    expect(await controller.donate(donating("203.0.113.2"))).toMatchObject({
      data: { redirectURL: "https://pay.example" },
    });
  });

  it("count the foreign donation form too", async () => {
    for (let i = 0; i < 20; i++) {
      await controller.donateForeign(donating("203.0.113.3"));
    }

    expect(
      await controller.donateForeign(donating("203.0.113.3")),
    ).toMatchObject({ status: 429 });
  });

  it("aren't limited behind a proxy that hides donors' addresses", async () => {
    for (let i = 0; i < 25; i++) {
      expect(await controller.donate(donating("127.0.0.1"))).toMatchObject({
        data: { redirectURL: "https://pay.example" },
      });
    }
  });
});
