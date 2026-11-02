import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "koa";

const repository = vi.hoisted(() => ({
  findById: vi.fn(),
  finalize: vi.fn(),
}));
const decodeOrderToken = vi.hoisted(() => vi.fn());

vi.mock("../../../../../db/repositories/donations.repository", () => ({
  DonationsRepository: class {
    findById = repository.findById;
    finalize = repository.finalize;
  },
}));
vi.mock("../../../../../utils/montonio", () => ({
  default: { decodeOrderToken },
}));

const { default: controllerFactory } = await import("../donation");

const service = {
  sendConfirmationEmail: vi.fn(),
  sendExternalConfirmationEmail: vi.fn(),
  sendDedicationEmail: vi.fn(),
};
const log = { error: vi.fn() };
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
    repository.finalize.mockResolvedValue({ id: 7, finalized: true });
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

  it("answers a repeated notification as done, without sending anything again", async () => {
    repository.finalize.mockResolvedValue(undefined);

    const result = await controller.confirm(notification());

    expect(result).toEqual({ data: null, status: 204 });
    expect(service.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(service.sendDedicationEmail).not.toHaveBeenCalled();
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
