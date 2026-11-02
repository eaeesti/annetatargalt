import { describe, it, expect, vi } from "vitest";
import type { Context } from "koa";

const transferService = vi.hoisted(() => ({
  remove: vi.fn(async () => ({ ok: false, reason: "has-links" })),
}));
const bankTransactionService = vi.hoisted(() => ({
  reclassify: vi.fn(async () => ({ ok: false, reason: "has-donations" })),
}));

vi.mock("../../services/transfer", () => ({
  createTransferService: () => transferService,
}));
vi.mock("../../services/bank-transaction", () => ({
  createBankTransactionService: () => bankTransactionService,
}));
vi.mock("../../../../../db/repositories/donation-transfers.repository", () => ({
  donationTransfersRepository: {},
}));
vi.mock("../../utils/audit-log", () => ({ auditLog: vi.fn() }));

const { default: transferController } = await import("../transfer");
const { default: bankTransactionController } =
  await import("../bankTransaction");

// The handlers use Strapi only through the services mocked above.
// oxlint-disable-next-line typescript/consistent-type-assertions
const strapi = {} as never;

/** A request to a handler, which answers through `send`. */
function request(params: Record<string, string>, body: unknown = {}) {
  // A test double for Koa's context, which can't be built whole in a test.
  // oxlint-disable-next-line typescript/consistent-type-assertions
  return {
    params,
    request: { body },
    state: {},
    send: vi.fn((data: unknown, status?: number) => ({ data, status })),
    notFound: vi.fn(),
    badRequest: vi.fn(),
  } as unknown as Context;
}

// ctx.send answers 200 unless it's given the status, whatever ctx.status
// was set to before it.
describe("a change the data doesn't allow", () => {
  it("answers 409 when a transfer to delete still has links", async () => {
    const controller = transferController({ strapi });

    const result = await controller.remove(request({ id: "4" }));

    expect(result).toMatchObject({ status: 409 });
  });

  it("answers 409 when a bank payment with donations is reclassified", async () => {
    const controller = bankTransactionController({ strapi });

    const result = await controller.update(
      request({ code: "2026100500000001" }, { category: "other" }),
    );

    expect(result).toMatchObject({ status: 409 });
  });
});
