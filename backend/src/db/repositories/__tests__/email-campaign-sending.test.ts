/**
 * Integration test for sending an email from the admin panel, from the first
 * click to the last copy. It isn't a repository, but it needs the test
 * database, which only the tests in this folder get. Strapi is a stand-in
 * that records what would have been mailed.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Core } from "@strapi/strapi";
import { createEmailCampaignService } from "../../../plugins/admin-panel/server/services/email-campaign";
import { emailCampaignsRepository } from "../email-campaigns.repository";
import { emailSendsRepository } from "../email-sends.repository";
import { donorsRepository } from "../donors.repository";
import { db } from "../../client";
import { emailCampaigns, emailSends } from "../../schema";
import {
  cleanDatabase,
  createTestDonor,
  createTestDonation,
  createTestOrganizationDonation,
} from "../../__tests__/test-db-helper";

interface Mailed {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

const mailed: Mailed[] = [];
const send = vi.fn(async (email: Mailed) => {
  mailed.push(email);
});

const emailConfig = {
  preferencesLinkText: "Choose your emails",
  footerText: "Footer",
};

/** How many of the next reads of the email config fail. */
let emailConfigFailures = 0;

/** The media library's pictures, with their widths. */
const library = [
  {
    url: "https://res.cloudinary.com/demo/image/upload/v1/talgud.webp",
    width: 1600,
  },
];

const fakeStrapi = {
  plugin: () => ({ service: () => ({ send }) }),
  documents: (uid: string) => ({
    findFirst: async () => {
      // Donors' support goes to "at", as the site settings say
      if (uid === "api::global.global") {
        return { tipOrganizationInternalId: "at" };
      }
      if (uid !== "api::email-config.email-config") return null;
      if (emailConfigFailures > 0) {
        emailConfigFailures--;
        throw new Error("Connection reset");
      }
      return emailConfig;
    },
    // Organizations' names, for a summary's variables.
    findMany: async () => [],
  }),
  config: { get: () => ["test-app-key"] },
  log: { error: vi.fn(), warn: vi.fn() },
  db: {
    query: () => ({
      findMany: async ({ where }: { where: { url: { $in: string[] } } }) =>
        library.filter((file) => where.url.$in.includes(file.url)),
    }),
  },
};
const service = createEmailCampaignService(
  // oxlint-disable-next-line typescript/consistent-type-assertions
  fakeStrapi as unknown as Core.Strapi,
);

async function giver(email: string, idCode: string | null) {
  const donor = await createTestDonor({ email, idCode });
  await createTestDonation({ donorId: donor.id });
  return donor;
}

async function newsletter() {
  return emailCampaignsRepository.create({
    kind: "newsletter",
    content: {
      subject: { et: "Uudised", en: "News" },
      blocks: [
        {
          id: "1",
          traits: {},
          text: { et: "Tere {{firstName}}", en: "" },
        },
      ],
    },
    audience: {},
  });
}

/** Until the email is no longer being sent, or a few seconds have passed. */
async function finished(id: number) {
  for (let i = 0; i < 100; i++) {
    const campaign = await emailCampaignsRepository.findById(id);
    if (campaign && !campaign.heartbeatAt) return campaign;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Email ${id} was still being sent`);
}

describe("sending an email from the admin panel", () => {
  beforeEach(async () => {
    await cleanDatabase();
    mailed.length = 0;
    send.mockClear();
    process.env.FRONTEND_URL = "https://example.org";
  });

  it("lets an email for supporters through, as the editor's check does", async () => {
    const supporter = await createTestDonor({
      email: "mari@example.org",
      idCode: null,
    });
    const donation = await createTestDonation({
      donorId: supporter.id,
      datetime: new Date("2026-03-01T12:00:00Z"),
      amount: 1200,
    });
    await createTestOrganizationDonation({
      donationId: donation.id,
      organizationInternalId: "at",
      amount: 200,
    });
    const audience = { period: { from: "2026-01-01", to: "2026-12-31" } };
    const recipients = await emailCampaignsRepository.findRecipients(
      "yearly",
      audience,
    );
    const content = {
      subject: { et: "Aitäh", en: "" },
      blocks: [
        {
          id: "1",
          traits: { supportedUs: true },
          text: { et: "Aitäh, et toetasid meid!", en: "" },
        },
      ],
    };

    expect(
      await service.errors("yearly", content, audience, recipients),
    ).toEqual([]);
  });

  it("gives a picture from the media library its width, for Outlook", async () => {
    process.env.CLOUDINARY_NAME = "demo";
    await giver("mari@example.org", "38207162722");
    const campaign = await emailCampaignsRepository.create({
      kind: "newsletter",
      content: {
        subject: { et: "Talgud", en: "" },
        blocks: [
          {
            id: "1",
            traits: {},
            text: {
              et: `Tere!\n\n![Talgupäev](${library[0]?.url})`,
              en: "",
            },
          },
        ],
      },
      audience: {},
    });

    await service.start(campaign, "newsletter");
    await finished(campaign.id);

    expect(mailed[0]?.html).toContain('alt="Talgupäev" width="520"');
  });

  it("sends one copy per address, with its unsubscribe link, and is then sent", async () => {
    await giver("mari@example.org", "38207162722");
    await giver("Mari@Example.org", null);
    await giver("jaan@example.org", "49403136526");
    const campaign = await newsletter();

    await service.start(campaign, "newsletter");
    const done = await finished(campaign.id);

    expect(done.status).toBe("sent");
    // To each address as its row that gave last writes it
    expect(mailed.map((email) => email.to.toLowerCase()).sort()).toEqual([
      "jaan@example.org",
      "mari@example.org",
    ]);
    for (const email of mailed) {
      expect(email.html).toContain(
        "https://example.org/api/email-settings?locale=et#token=",
      );
      expect(email.headers?.["List-Unsubscribe"]).toMatch(
        /\/api\/unsubscribe\?token=[^&>]+&kind=newsletter&locale=et>$/,
      );
    }
  });

  /** An email whose sender stopped, or stalled: its heartbeat is long gone. */
  async function abandoned(id: number) {
    await db
      .update(emailCampaigns)
      .set({ heartbeatAt: new Date(Date.now() - 60 * 60 * 1000) })
      .where(eq(emailCampaigns.id, id));
    const campaign = await emailCampaignsRepository.findById(id);
    if (!campaign) throw new Error(`Email ${id} is gone`);
    return campaign;
  }

  it("finishes an email whose sending stopped after its last copy", async () => {
    const mari = await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();
    await emailCampaignsRepository.queue(campaign.id, [mari.id]);
    await emailCampaignsRepository.claimSending(campaign.id, "stopped");
    const copy = await emailSendsRepository.claimNext(campaign.id, "stopped");
    if (copy) await emailSendsRepository.markSent(copy.id);

    await service.start(await abandoned(campaign.id), "newsletter");
    const done = await finished(campaign.id);

    expect(done.status).toBe("sent");
    expect(mailed).toEqual([]);
  });

  it("sends a copy whose sender stopped after claiming it", async () => {
    const mari = await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();
    await emailCampaignsRepository.queue(campaign.id, [mari.id]);
    await emailCampaignsRepository.claimSending(campaign.id, "stopped");
    await emailSendsRepository.claimNext(campaign.id, "stopped");

    await service.start(await abandoned(campaign.id), "newsletter");
    const done = await finished(campaign.id);

    expect(done.status).toBe("sent");
    expect(mailed.map((email) => email.to)).toEqual(["mari@example.org"]);
  });

  it("goes on by itself with an email whose sending was cut off", async () => {
    const mari = await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();
    await emailCampaignsRepository.queue(campaign.id, [mari.id]);
    await emailCampaignsRepository.claimSending(campaign.id, "deployed");
    await abandoned(campaign.id);

    await service.resumeCutOff();
    const done = await finished(campaign.id);

    expect(done.status).toBe("sent");
    expect(mailed.map((email) => email.to)).toEqual(["mari@example.org"]);
  });

  it("sends each copy once when the first sender only stalled", async () => {
    const mari = await giver("mari@example.org", "38207162722");
    const jaan = await giver("jaan@example.org", "49403136526");
    const campaign = await newsletter();
    await emailCampaignsRepository.queue(campaign.id, [mari.id, jaan.id]);
    await emailCampaignsRepository.claimSending(campaign.id, "stalled");
    const claimed = await emailSendsRepository.claimNext(
      campaign.id,
      "stalled",
    );
    if (!claimed) throw new Error("Nothing was claimed");

    await service.start(await abandoned(campaign.id), "newsletter");
    await finished(campaign.id);
    // The stalled sender wakes up with the copy it had claimed.
    const stillMine = await emailSendsRepository.markSending(
      claimed.id,
      campaign.id,
      "stalled",
    );

    expect(stillMine).toBe(false);
    expect(mailed.map((email) => email.to).sort()).toEqual([
      "jaan@example.org",
      "mari@example.org",
    ]);
  });

  it("stops when the CMS can't be read, and reads it again when it goes on", async () => {
    await giver("mari@example.org", "38207162722");
    await giver("jaan@example.org", "49403136526");
    const campaign = await newsletter();
    emailConfigFailures = 1;
    try {
      await service.start(campaign, "newsletter");
      const stopped = await finished(campaign.id);
      // Not every copy failed in turn: the first is back in the queue
      expect(stopped.status).toBe("sending");
      expect(
        await emailSendsRepository.countByStatus(campaign.id),
      ).toMatchObject({ queued: 2, failed: 0 });
      expect(await emailSendsRepository.findStopReason(campaign.id)).toBe(
        "Connection reset",
      );

      await service.start(stopped, "newsletter");
      await finished(campaign.id);
    } finally {
      emailConfigFailures = 0;
    }

    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { sent: 2, queued: 0 },
    );
  });

  it("stops when a copy can't be made, and sends it when it goes on", async () => {
    await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();
    const findRecipient = vi
      .spyOn(emailCampaignsRepository, "findRecipient")
      .mockRejectedValueOnce(new Error("Connection reset"));
    try {
      await service.start(campaign, "newsletter");
      const stopped = await finished(campaign.id);
      expect(stopped.status).toBe("sending");
      expect(
        await emailSendsRepository.countByStatus(campaign.id),
      ).toMatchObject({ queued: 1, failed: 0 });

      await service.start(stopped, "newsletter");
      await finished(campaign.id);
    } finally {
      findRecipient.mockRestore();
    }

    expect(mailed.map((email) => email.to)).toEqual(["mari@example.org"]);
    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { sent: 1, failed: 0 },
    );
  });

  it("never sends again a copy the mail server may have taken, and waits for the team", async () => {
    await giver("mari@example.org", "38207162722");
    await giver("jaan@example.org", "49403136526");
    const campaign = await newsletter();
    // The connection goes while waiting for the server's reply
    send.mockRejectedValueOnce(
      Object.assign(new Error("Timeout"), {
        code: "ETIMEDOUT",
        timeoutType: "SOCKET_TIMEOUT",
      }),
    );

    await service.start(campaign, "newsletter");
    const stopped = await finished(campaign.id);
    expect(stopped.status).toBe("sending");
    expect(stopped.heldFor).toBe(
      "the mail server didn't answer whether it took a copy: Timeout",
    );
    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { sending: 1, queued: 1, failed: 0 },
    );
    // Not by itself: a server that keeps doing it would leave every copy so
    await service.resumeCutOff();
    expect(send).toHaveBeenCalledTimes(1);

    // "Continue sending" sends the other copy, and not the first again
    await service.start(stopped, "newsletter");
    await finished(campaign.id);
    expect(send).toHaveBeenCalledTimes(2);
    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { sending: 1, sent: 1, queued: 0 },
    );
  });

  /** The mail server's reply to a copy, as nodemailer throws it. */
  const reply = (responseCode: number, command: string) =>
    Object.assign(new Error(`${responseCode} No`), {
      code: command === "RCPT TO" ? "EENVELOPE" : "EAUTH",
      command,
      responseCode,
      permanent: responseCode >= 500,
    });

  it("fails a copy whose address the server refused, and goes on with the next", async () => {
    await giver("mari@example.org", "38207162722");
    await giver("jaan@example.org", "49403136526");
    const campaign = await newsletter();
    send.mockRejectedValueOnce(reply(550, "RCPT TO"));

    await service.start(campaign, "newsletter");
    const done = await finished(campaign.id);

    expect(done.status).toBe("sent");
    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { failed: 1, sent: 1 },
    );
  });

  it("fails a copy to what isn't an address, and goes on with the next", async () => {
    await giver("vana aadress@example", null);
    await giver("jaan@example.org", "49403136526");
    const campaign = await newsletter();

    await service.start(campaign, "newsletter");
    await finished(campaign.id);

    expect(mailed.map((email) => email.to)).toEqual(["jaan@example.org"]);
    expect(await emailSendsRepository.findFailed(campaign.id)).toMatchObject([
      { error: "Not an email address" },
    ]);
  });

  /** How many times each of an email's copies has been tried. */
  async function tries(campaignId: number) {
    const rows = await db
      .select({ attempts: emailSends.attempts })
      .from(emailSends)
      .where(eq(emailSends.campaignId, campaignId));
    return rows.map((row) => row.attempts);
  }

  it("waits for the team at a sign-in refused or a try again later, failing nothing", async () => {
    await giver("mari@example.org", "38207162722");
    await giver("jaan@example.org", "49403136526");
    const campaign = await newsletter();
    send
      .mockRejectedValueOnce(reply(535, "AUTH PLAIN"))
      .mockRejectedValueOnce(reply(421, "RCPT TO"));

    await service.start(campaign, "newsletter");
    let stopped = await finished(campaign.id);
    expect(stopped.status).toBe("sending");
    expect(stopped.heldFor).toBe("the mail server didn't take a copy: 535 No");
    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { queued: 2, failed: 0 },
    );
    // Not by itself, as every minute in production
    await service.resumeCutOff();
    expect(send).toHaveBeenCalledTimes(1);

    // "Continue sending", twice
    await service.start(stopped, "newsletter");
    stopped = await finished(campaign.id);
    expect(stopped.heldFor).toBe("the mail server didn't take a copy: 421 No");

    await service.start(stopped, "newsletter");
    const done = await finished(campaign.id);
    expect(done.status).toBe("sent");
    expect(mailed).toHaveLength(2);
    // The server's failures weren't the copies' own
    expect(await tries(campaign.id)).toEqual([0, 0]);
  });

  it("uses up no copy's tries while the mail server keeps failing", async () => {
    await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();
    // A sign-in key that was revoked, as the team goes on again and again
    send.mockRejectedValue(reply(535, "AUTH PLAIN"));
    try {
      let current = campaign;
      for (let go = 0; go < 4; go++) {
        await service.start(current, "newsletter");
        current = await finished(campaign.id);
      }
      expect(current.status).toBe("sending");
    } finally {
      send.mockReset();
      send.mockImplementation(async (email: Mailed) => {
        mailed.push(email);
      });
    }

    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { queued: 1, failed: 0 },
    );
    expect(await tries(campaign.id)).toEqual([0]);
  });

  it("puts a copy that keeps failing behind the rest, and fails it the third time", async () => {
    const mari = await giver("mari@example.org", "38207162722");
    await giver("jaan@example.org", "49403136526");
    const campaign = await newsletter();
    // Mari's copy can't be made, whatever's tried
    const original = emailCampaignsRepository.findRecipient.bind(
      emailCampaignsRepository,
    );
    const findRecipient = vi
      .spyOn(emailCampaignsRepository, "findRecipient")
      .mockImplementation(async (kind, donorId, audience) => {
        if (donorId === mari.id) throw new Error("Her language can't be read");
        return original(kind, donorId, audience);
      });
    try {
      let current = campaign;
      for (let go = 0; go < 3; go++) {
        await service.start(current, "newsletter");
        current = await finished(campaign.id);
      }
      expect(current.status).toBe("sent");
    } finally {
      findRecipient.mockRestore();
    }

    expect(mailed.map((email) => email.to)).toEqual(["jaan@example.org"]);
    expect(await emailSendsRepository.findFailed(campaign.id)).toMatchObject([
      { donorId: mari.id, error: "Her language can't be read" },
    ]);
  });

  /** Minutes from now until a time, to the nearest. */
  const minutesUntil = (time: Date | null | undefined) =>
    Math.round(((time?.getTime() ?? 0) - Date.now()) / 60_000);

  /** As if the time an email's waiting copies wait for had come. */
  async function waitIsOver(campaignId: number) {
    await db
      .update(emailSends)
      .set({ retryAt: new Date(Date.now() - 1000) })
      .where(
        and(
          eq(emailSends.campaignId, campaignId),
          eq(emailSends.status, "queued"),
        ),
      );
  }

  it("goes on with the rest past an address refused for now, and sends it after a wait", async () => {
    await giver("mari@example.org", "38207162722");
    await giver("jaan@example.org", "49403136526");
    const campaign = await newsletter();
    send.mockRejectedValueOnce(reply(452, "RCPT TO"));

    await service.start(campaign, "newsletter");
    let stopped = await finished(campaign.id);
    expect(mailed.map((email) => email.to)).toEqual(["jaan@example.org"]);
    expect(stopped.status).toBe("sending");
    const progress = await service.progress(stopped);
    expect(progress).toMatchObject({ queued: 1, waiting: 1 });
    expect(minutesUntil(progress.nextTry)).toBe(15);
    // It waits; sending didn't stop for it
    expect(progress.stoppedBy).toBeNull();

    // Going on before then sends nothing
    await service.start(stopped, "newsletter");
    stopped = await finished(campaign.id);
    expect(send).toHaveBeenCalledTimes(2);

    await waitIsOver(campaign.id);
    await service.start(stopped, "newsletter");
    const done = await finished(campaign.id);
    expect(done.status).toBe("sent");
    expect(mailed.map((email) => email.to)).toEqual([
      "jaan@example.org",
      "mari@example.org",
    ]);
  });

  it("waits longer for an address refused for now again, and fails it the third time", async () => {
    await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();
    send
      .mockRejectedValueOnce(reply(452, "RCPT TO"))
      .mockRejectedValueOnce(reply(452, "RCPT TO"))
      .mockRejectedValueOnce(reply(452, "RCPT TO"));

    await service.start(campaign, "newsletter");
    let stopped = await finished(campaign.id);
    expect(minutesUntil((await service.progress(stopped)).nextTry)).toBe(15);

    await waitIsOver(campaign.id);
    await service.start(stopped, "newsletter");
    stopped = await finished(campaign.id);
    expect(minutesUntil((await service.progress(stopped)).nextTry)).toBe(60);

    await waitIsOver(campaign.id);
    await service.start(stopped, "newsletter");
    const done = await finished(campaign.id);
    expect(done.status).toBe("sent");
    expect(await emailSendsRepository.findFailed(campaign.id)).toMatchObject([
      { error: "452 No" },
    ]);
  });

  it("doesn't wait for the team when only addresses refused before are refused again", async () => {
    for (const name of ["a", "b", "c", "d", "e", "f"]) {
      await giver(`${name}@example.org`, null);
    }
    const campaign = await newsletter();
    // Every other copy refused for now, then all three again the next time
    let call = 0;
    send.mockImplementation(async (email: Mailed) => {
      call += 1;
      if ([1, 3, 5, 7, 8, 9].includes(call)) throw reply(452, "RCPT TO");
      mailed.push(email);
    });
    try {
      await service.start(campaign, "newsletter");
      const first = await finished(campaign.id);
      expect(mailed).toHaveLength(3);

      await waitIsOver(campaign.id);
      await service.start(first, "newsletter");
      const second = await finished(campaign.id);
      expect(call).toBe(9);
      expect(second.heldFor).toBeNull();
      expect(
        await emailSendsRepository.countByStatus(campaign.id),
      ).toMatchObject({ sent: 3, queued: 3 });
      // To go on by itself, as after a deploy
      expect(
        (await emailCampaignsRepository.findCutOff()).map((c) => c.id),
      ).toEqual([campaign.id]);
    } finally {
      send.mockImplementation(async (email: Mailed) => {
        mailed.push(email);
      });
    }
  });

  it("stops when address after address is refused, until the team goes on", async () => {
    for (const name of ["a", "b", "c", "d"]) {
      await giver(`${name}@example.org`, null);
    }
    const campaign = await newsletter();
    send
      .mockRejectedValueOnce(reply(550, "RCPT TO"))
      .mockRejectedValueOnce(reply(550, "RCPT TO"))
      .mockRejectedValueOnce(reply(550, "RCPT TO"));

    await service.start(campaign, "newsletter");
    const stopped = await finished(campaign.id);
    expect(stopped.status).toBe("sending");
    expect(stopped.heldFor).toBe(
      "3 addresses in a row were refused, the last with: 550 No",
    );
    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { failed: 3, queued: 1 },
    );

    // Not by itself, as after a deploy
    await service.resumeCutOff();
    expect(send).toHaveBeenCalledTimes(3);
    expect(await emailCampaignsRepository.findCutOff()).toEqual([]);

    // "Continue sending"
    await service.start(stopped, "newsletter");
    const done = await finished(campaign.id);
    expect(done.status).toBe("sent");
    expect(done.heldFor).toBeNull();
    expect(mailed.map((email) => email.to)).toEqual(["d@example.org"]);
  });

  it("tries failed copies again only when asked, not when sending goes on", async () => {
    await giver("mari@example.org", "38207162722");
    await giver("jaan@example.org", "49403136526");
    const campaign = await newsletter();
    send
      .mockRejectedValueOnce(reply(550, "RCPT TO"))
      .mockRejectedValueOnce(reply(421, "RCPT TO"));

    await service.start(campaign, "newsletter");
    const stopped = await finished(campaign.id);
    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { failed: 1, queued: 1 },
    );

    // "Continue sending": the queued one, not the failed one
    await service.start(stopped, "newsletter");
    const done = await finished(campaign.id);
    expect(done.status).toBe("sent");
    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { failed: 1, sent: 1 },
    );

    // "Try the failed ones again"
    await service.start(done, "newsletter");
    await finished(campaign.id);
    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { failed: 0, sent: 2 },
    );
  });

  it("never sends a copy twice when saving that it went out fails", async () => {
    await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();
    const markSent = vi
      .spyOn(emailSendsRepository, "markSent")
      .mockRejectedValueOnce(new Error("Connection reset"));
    try {
      await service.start(campaign, "newsletter");
      const done = await finished(campaign.id);
      // Gone out, though it couldn't be saved: not failed, not to be retried.
      expect(
        await emailSendsRepository.countByStatus(campaign.id),
      ).toMatchObject({ sending: 1, failed: 0, queued: 0 });

      await service.start(done, "newsletter");
      await finished(campaign.id);
    } finally {
      markSent.mockRestore();
    }

    expect(mailed).toHaveLength(1);
  });

  it("never reaches a donor who joined the group after the first send", async () => {
    await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();
    await service.start(campaign, "newsletter");
    await finished(campaign.id);

    await giver("jaan@example.org", "49403136526");
    const sent = await emailCampaignsRepository.findById(campaign.id);
    if (sent) await service.start(sent, "newsletter");
    await finished(campaign.id);

    expect(mailed.map((email) => email.to)).toEqual(["mari@example.org"]);
  });

  it("skips a donor who turned the emails off after the group was queued", async () => {
    const mari = await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();
    await emailCampaignsRepository.queue(campaign.id, [mari.id]);
    await donorsRepository.updateEmailPreferences(mari.id, {
      newsletter: false,
    });

    const queued = await emailCampaignsRepository.findById(campaign.id);
    if (queued) await service.start(queued, "newsletter");
    await finished(campaign.id);

    expect(mailed).toEqual([]);
    expect(await emailSendsRepository.countByStatus(campaign.id)).toMatchObject(
      { skipped: 1, sent: 0 },
    );
  });

  it("shows the email as a donor who is what's asked, and counts them", async () => {
    await giver("mari@example.org", "49001010000");
    const juku = await giver("juku@example.org", null);
    await giver("kati@example.org", null);
    const campaign = await newsletter();
    const as = (traits: Record<string, boolean>) =>
      service.preview("newsletter", campaign.content, {}, null, null, traits);

    expect(await as({ hasIdCode: false })).toMatchObject({
      donorId: juku.id,
      matching: 2,
    });
    expect(await as({ hasIdCode: false, recurring: false })).toMatchObject({
      matching: 2,
    });
    // No one: shown as the first of the group, and said so.
    expect(await as({ hasIdCode: false, recurring: true })).toMatchObject({
      matching: 0,
    });
    expect((await as({})).matching).toBe(3);
  });

  it("shows an email to a group with no one in it in the group's language", async () => {
    await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();

    const preview = await service.preview(
      "newsletter",
      campaign.content,
      { locale: "en" },
      null,
      null,
    );

    expect(preview).toMatchObject({ donorId: null, locale: "en" });
  });

  it("shows the team a preview whose link shows no donor's choices", async () => {
    await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();

    const preview = await service.preview(
      "newsletter",
      campaign.content,
      {},
      null,
      "et",
    );

    expect(preview.html).toContain(
      'href="https://example.org/api/email-settings?locale=et"',
    );
    expect(preview.html).not.toContain("token=");
  });

  it("links to the page for choosing emails when the CMS has no words for it", async () => {
    await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();
    emailConfig.preferencesLinkText = " ";
    try {
      await service.start(campaign, "newsletter");
      await finished(campaign.id);
    } finally {
      emailConfig.preferencesLinkText = "Choose your emails";
    }

    expect(mailed[0]?.html).toContain("Vali, milliseid e-kirju meilt saad");
    expect(mailed[0]?.html).toContain(
      "https://example.org/api/email-settings?locale=et#token=",
    );
  });

  it("sends a test with no donor's link, and an unsubscribe button that stops nothing", async () => {
    await giver("mari@example.org", "38207162722");
    const campaign = await newsletter();

    await service.sendTest(campaign, "newsletter", "team@example.org");

    expect(mailed).toHaveLength(1);
    expect(mailed[0]?.to).toBe("team@example.org");
    expect(mailed[0]?.html).toContain(
      'href="https://example.org/api/email-settings?locale=et"',
    );
    expect(mailed[0]?.html).not.toContain("token=");
    // Brevo would add its own, whose one click blocks the team's address
    expect(mailed[0]?.headers).toEqual({
      "List-Unsubscribe": "<https://example.org/api/email-settings?locale=et>",
    });
  });
});
