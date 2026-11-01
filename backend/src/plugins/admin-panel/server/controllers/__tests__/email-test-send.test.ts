import { describe, expect, it, vi } from "vitest";
import type { Context } from "koa";

const service = vi.hoisted(() => ({
  sendTest: vi.fn(async () => {
    throw new Error("Mail server refused the connection");
  }),
}));
vi.mock("../../services/email-campaign", () => ({
  createEmailCampaignService: () => service,
  kindOf: () => "newsletter",
}));
vi.mock("../../../../../db/repositories", () => ({
  emailCampaignsRepository: { findById: async () => ({ id: 4 }) },
}));
vi.mock("../../utils/audit-log", () => ({ auditLog: vi.fn() }));

const { default: emailCampaignController } = await import("../emailCampaign");

const error = vi.fn();
// oxlint-disable-next-line typescript/consistent-type-assertions
const strapi = { log: { error } } as never;
const controller = emailCampaignController({ strapi });

describe("a test email", () => {
  it("that couldn't be sent says why", async () => {
    const reply = (status: number) =>
      vi.fn((message: unknown) => ({ status, message }));
    // A test double for Koa's context, which can't be built whole in a test.
    // oxlint-disable-next-line typescript/consistent-type-assertions
    const ctx = {
      params: { id: "4" },
      state: { user: { id: 1, email: "team@example.org" } },
      serviceUnavailable: reply(503),
      badRequest: reply(400),
      notFound: reply(404),
      unauthorized: reply(401),
      send: vi.fn((body: unknown) => ({ status: 200, body })),
    } as unknown as Context;

    const result: unknown = await controller.test(ctx);

    expect(result).toEqual({
      status: 503,
      message: expect.stringContaining("Mail server refused the connection"),
    });
    expect(error).toHaveBeenCalled();
  });
});
