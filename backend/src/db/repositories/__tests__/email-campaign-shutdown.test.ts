/**
 * Integration test for a backend process shutting down, as in a deploy,
 * while it's sending an email. On its own: shutting down is for the whole
 * process, so nothing else in it sends afterwards.
 */

import { describe, it, expect, vi } from "vitest";
import type { Core } from "@strapi/strapi";
import {
  createEmailCampaignService,
  stopSending,
} from "../../../plugins/admin-panel/server/services/email-campaign";
import { emailCampaignsRepository } from "../email-campaigns.repository";
import { emailSendsRepository } from "../email-sends.repository";
import {
  cleanDatabase,
  createTestDonor,
  createTestDonation,
} from "../../__tests__/test-db-helper";

let handedOver: () => void = () => {};
const send = vi.fn(
  () =>
    new Promise<void>((resolve) => {
      handedOver = resolve;
    }),
);
const fakeStrapi = {
  plugin: () => ({ service: () => ({ send }) }),
  documents: () => ({ findFirst: async () => null, findMany: async () => [] }),
  config: { get: () => ["test-app-key"] },
  log: { error: vi.fn() },
};
const service = createEmailCampaignService(
  // oxlint-disable-next-line typescript/consistent-type-assertions
  fakeStrapi as unknown as Core.Strapi,
);

describe("shutting down while an email is being sent", () => {
  it("finishes the copy being handed over, and leaves the rest", async () => {
    await cleanDatabase();
    process.env.FRONTEND_URL = "https://example.org";
    for (const [email, idCode] of [
      ["mari@example.org", "38207162722"],
      ["jaan@example.org", "49403136526"],
    ] as const) {
      const donor = await createTestDonor({ email, idCode });
      await createTestDonation({ donorId: donor.id });
    }
    const campaign = await emailCampaignsRepository.create({
      kind: "newsletter",
      content: {
        subject: { et: "Uudised", en: "News" },
        blocks: [{ id: "1", traits: {}, text: { et: "Tere", en: "" } }],
      },
      audience: {},
    });

    await service.start(campaign, "newsletter");
    while (send.mock.calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const stopped = stopSending();
    handedOver();
    await stopped;

    expect(send).toHaveBeenCalledTimes(1);
    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { sent: 1, queued: 1, sending: 0 },
    );
    // Left for another process to take up at once
    const left = await emailCampaignsRepository.findById(campaign.id);
    expect(left?.status).toBe("sending");
    expect(left?.heartbeatAt).toBeNull();

    // And this one takes nothing up any more
    await service.resumeCutOff();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
