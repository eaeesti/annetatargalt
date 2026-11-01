import { describe, expect, it, vi } from "vitest";
import type { Context } from "koa";

const service = vi.hoisted(() => ({
  errors: vi.fn(async () => []),
  start: vi.fn(async () => true),
}));
vi.mock("../../services/email-campaign", () => ({
  createEmailCampaignService: () => service,
  kindOf: () => "newsletter",
}));
vi.mock("../../../../../db/repositories", () => ({
  emailCampaignsRepository: {
    findById: async () => ({ id: 4, status: "draft", audience: {} }),
    // One donor in the group
    findRecipients: async () => [{ donorId: 1 }],
  },
}));
vi.mock("../../utils/audit-log", () => ({ auditLog: vi.fn() }));

const { default: emailCampaignController } = await import("../emailCampaign");

// oxlint-disable-next-line typescript/consistent-type-assertions
const controller = emailCampaignController({ strapi: {} as never });

/** Send a draft, saying it's to go to `count` donors, or not saying. */
async function send(body: Record<string, unknown>) {
  const reply = (status: number) => vi.fn(() => ({ status }));
  // A test double for Koa's context, which can't be built whole in a test.
  // oxlint-disable-next-line typescript/consistent-type-assertions
  const ctx = {
    params: { id: "4" },
    request: { body },
    state: {},
    badRequest: reply(400),
    notFound: reply(404),
    conflict: reply(409),
    send: vi.fn(() => ({ status: 200 })),
  } as unknown as Context;
  return controller.send(ctx);
}

describe("sending a draft", () => {
  it("goes ahead only for as many donors as the admin agreed to", async () => {
    expect(await send({})).toEqual({ status: 400 });
    expect(await send({ count: 2 })).toEqual({ status: 409 });
    expect(service.start).not.toHaveBeenCalled();
    expect(await send({ count: 1 })).toEqual({ status: 200 });
    expect(service.start).toHaveBeenCalledTimes(1);
  });
});
