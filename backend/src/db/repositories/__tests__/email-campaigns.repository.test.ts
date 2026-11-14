/**
 * Integration tests for the emails sent from the admin panel: who they go to,
 * the queue a send works through, and donors' settings, which belong to an
 * address rather than a donor row.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EmailCampaignsRepository,
  emailCampaignsRepository,
} from "../email-campaigns.repository";
import { emailSendsRepository } from "../email-sends.repository";
import { donorsRepository } from "../donors.repository";
import { donationsRepository } from "../donations.repository";
import { emptyContent } from "../../../utils/email-campaign";
import { eq } from "drizzle-orm";
import { db } from "../../client";
import { emailCampaigns } from "../../schema";
import {
  cleanDatabase,
  createTestDonor,
  createTestDonation,
  createTestOrganizationDonation,
  createTestRecurringDonation,
} from "../../__tests__/test-db-helper";

/** A donor who has given once, at `datetime`. */
async function giver(
  donor: Parameters<typeof createTestDonor>[0],
  donation: Parameters<typeof createTestDonation>[0] = {},
) {
  const created = await createTestDonor(donor);
  await createTestDonation({ donorId: created.id, ...donation });
  return created;
}

function draft() {
  return emailCampaignsRepository.create({
    kind: "newsletter",
    content: emptyContent(),
    audience: {},
  });
}

describe("EmailCampaignsRepository", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("findRecipients", () => {
    it("sends one copy to an address, whatever its rows and letter case", async () => {
      const older = await giver(
        { email: "Mari@Example.org", idCode: null, firstName: "Old" },
        { datetime: new Date("2026-01-01") },
      );
      const newer = await giver(
        { email: " mari@example.org", idCode: "38207162722", firstName: "New" },
        { datetime: new Date("2026-06-01"), locale: "en" },
      );

      const recipients = await emailCampaignsRepository.findRecipients(
        "newsletter",
        {},
      );

      expect(recipients).toHaveLength(1);
      // Addressed as the row that gave last, in the language of that gift
      expect(recipients[0]).toMatchObject({
        donorId: newer.id,
        email: "mari@example.org",
        firstName: "New",
        locale: "en",
        idCode: "38207162722",
      });
      expect(recipients[0]?.donorId).not.toBe(older.id);
    });

    it("leaves an address out when any of its rows that gave turned the email off", async () => {
      await giver({ email: "a@example.org", idCode: null, newsletter: false });
      await giver({ email: "A@example.org", idCode: "38207162722" });

      expect(
        await emailCampaignsRepository.findRecipients("newsletter", {}),
      ).toEqual([]);
    });

    it("ignores the settings of a row that never paid", async () => {
      await giver({ email: "a@example.org", idCode: "38207162722" });
      await createTestDonor({
        email: "a@example.org",
        idCode: null,
        newsletter: false,
      });

      expect(
        await emailCampaignsRepository.findRecipients("newsletter", {}),
      ).toHaveLength(1);
    });

    it("counts the address as having an ID code when any of its rows has one", async () => {
      await giver(
        { email: "a@example.org", idCode: "38207162722" },
        { datetime: new Date("2026-01-01") },
      );
      await giver(
        { email: "a@example.org", idCode: null },
        { datetime: new Date("2026-06-01") },
      );

      expect(
        await emailCampaignsRepository.findRecipients("newsletter", {
          hasIdCode: true,
        }),
      ).toHaveLength(1);
      expect(
        await emailCampaignsRepository.findRecipients("newsletter", {
          hasIdCode: false,
        }),
      ).toEqual([]);
    });

    it("keeps donors without an address apart", async () => {
      await giver({ email: "", idCode: null });
      await giver({ email: "  ", idCode: "38207162722" });

      expect(
        await emailCampaignsRepository.findRecipients("newsletter", {}),
      ).toEqual([]);
    });
  });

  describe("only these addresses", () => {
    it("narrows the group to them, in any letter case", async () => {
      await giver({ email: "Mari@Example.org", idCode: null });
      await giver({ email: "juku@example.org", idCode: null });

      const recipients = await emailCampaignsRepository.findRecipients(
        "newsletter",
        { emails: ["mari@example.org", "someone@example.org"] },
      );

      expect(recipients.map((r) => r.email)).toEqual(["Mari@Example.org"]);
    });
  });

  describe("a period", () => {
    const year = { from: "2026-01-01", to: "2026-12-31" };

    /** A donation at `datetime`, split between organizations. */
    async function gift(
      donorId: number,
      datetime: string,
      split: Record<string, number>,
      donation: Parameters<typeof createTestDonation>[0] = {},
    ) {
      const amount = Object.values(split).reduce(
        (sum, cents) => sum + cents,
        0,
      );
      const created = await createTestDonation({
        donorId,
        datetime: new Date(datetime),
        amount,
        ...donation,
      });
      for (const [organizationInternalId, cents] of Object.entries(split)) {
        await createTestOrganizationDonation({
          donationId: created.id,
          organizationInternalId,
          amount: cents,
        });
      }
    }

    it("takes those who gave in it, its days in Estonian time", async () => {
      const lastYear = await createTestDonor({
        email: "a@example.org",
        idCode: null,
      });
      // 23:30 on 31 December in UTC is already 1 January in Tallinn.
      await gift(lastYear.id, "2025-12-31T23:30:00Z", { amf: 1000 });
      const late = await createTestDonor({
        email: "b@example.org",
        idCode: null,
      });
      // 22:30 on 31 December in UTC is 00:30 the next day in Tallinn.
      await gift(late.id, "2026-12-31T22:30:00Z", { amf: 1000 });
      const unpaid = await createTestDonor({
        email: "c@example.org",
        idCode: null,
      });
      await gift(
        unpaid.id,
        "2026-06-01T12:00:00Z",
        { amf: 1000 },
        { finalized: false },
      );
      await gift(unpaid.id, "2025-06-01T12:00:00Z", { amf: 1000 });

      const recipients = await emailCampaignsRepository.findRecipients(
        "yearly",
        { period: year },
      );

      expect(recipients.map((r) => r.email)).toEqual(["a@example.org"]);
    });

    it("adds up what an address gave in it, from all its rows", async () => {
      const first = await createTestDonor({
        email: "Mari@example.org",
        idCode: null,
      });
      const second = await createTestDonor({
        email: "mari@example.org",
        idCode: "49001010000",
      });
      await gift(first.id, "2026-03-01T12:00:00Z", { amf: 2000, at: 200 });
      await gift(second.id, "2026-09-01T12:00:00Z", { amf: 1000, thl: 500 });
      await gift(
        second.id,
        "2026-10-01T12:00:00Z",
        { thl: 5000 },
        { companyName: "Mari OÜ" },
      );
      await gift(second.id, "2025-10-01T12:00:00Z", { thl: 99_900 });

      const [recipient] = await emailCampaignsRepository.findRecipients(
        "yearly",
        { period: year },
      );

      expect(recipient?.gifts?.count).toBe(3);
      expect(recipient?.gifts?.companyCents).toBe(5000);
      expect(
        Object.fromEntries(
          (recipient?.gifts?.byOrganization ?? []).map((g) => [
            g.internalId,
            g.cents,
          ]),
        ),
      ).toEqual({ amf: 3000, at: 200, thl: 5500 });

      const queued = await emailCampaignsRepository.findRecipient(
        "yearly",
        first.id,
        { period: year },
      );
      expect(queued?.gifts).toEqual(recipient?.gifts);
    });

    it("finds the gifts of an old address with a tab or a no-break space on it", async () => {
      const tab = await createTestDonor({
        email: "Tab@example.org\t",
        idCode: null,
      });
      const space = await createTestDonor({
        email: "nbsp@example.org\u00a0",
        idCode: null,
      });
      await gift(tab.id, "2026-03-01T12:00:00Z", { amf: 1000 });
      await gift(space.id, "2026-03-01T12:00:00Z", { amf: 2000 });

      const recipients = await emailCampaignsRepository.findRecipients(
        "yearly",
        { period: year },
      );

      expect(recipients.map((r) => r.gifts?.count)).toEqual([1, 1]);
    });
  });

  it("reaches no one with a list of addresses that has none", async () => {
    await giver({ email: "a@example.org" });
    expect(
      await emailCampaignsRepository.findRecipients("newsletter", {
        emails: [],
      }),
    ).toEqual([]);
  });

  it("writes to a monthly donor in the language they set the order up in", async () => {
    const donor = await createTestDonor({ email: "a@example.org" });
    const order = await createTestRecurringDonation({
      donorId: donor.id,
      locale: "en",
    });
    // A payment from a bank statement, saved before imports kept the language
    await createTestDonation({
      donorId: donor.id,
      recurringDonationId: order.id,
      locale: "et",
    });

    const [recipient] = await emailCampaignsRepository.findRecipients(
      "newsletter",
      {},
    );
    expect(recipient?.locale).toBe("en");
  });

  it("writes in the language the address chose, whatever it gave in", async () => {
    const chose = await giver({ email: "a@example.org" }, { locale: "et" });
    await giver({ email: "A@example.org", idCode: null }, { locale: "et" });
    await giver({ email: "b@example.org" }, { locale: "en" });
    await donorsRepository.updateEmailPreferences(chose.id, {
      emailLocale: "en",
    });

    const languages = async (filters = {}) =>
      (await emailCampaignsRepository.findRecipients("newsletter", filters))
        .map((r) => [r.email.toLowerCase(), r.locale])
        .sort();
    expect(await languages()).toEqual([
      ["a@example.org", "en"],
      ["b@example.org", "en"],
    ]);
    expect(await languages({ locale: "et" })).toEqual([]);

    // Back to the language it last gave in
    await donorsRepository.updateEmailPreferences(chose.id, {
      emailLocale: null,
    });
    expect(await languages({ locale: "et" })).toEqual([
      ["a@example.org", "et"],
    ]);
  });

  describe("sending", () => {
    it("queues the group once, at the first send", async () => {
      const campaign = await draft();
      const donor = await giver({ email: "a@example.org" });

      expect(
        await emailCampaignsRepository.queue(campaign.id, [donor.id]),
      ).toBe(true);
      // A second click, or another process, finds it started already
      expect(
        await emailCampaignsRepository.queue(campaign.id, [donor.id]),
      ).toBe(false);
      expect(
        await emailSendsRepository.countByStatus(campaign.id),
      ).toMatchObject({ queued: 1 });
    });

    it("lets one process at a time send an email", async () => {
      const campaign = await draft();
      await emailCampaignsRepository.queue(campaign.id, []);

      expect(
        await emailCampaignsRepository.claimSending(campaign.id, "first"),
      ).toBe(true);
      expect(
        await emailCampaignsRepository.claimSending(campaign.id, "second"),
      ).toBe(false);
      const claimed = await emailCampaignsRepository.findById(campaign.id);
      expect(claimed && EmailCampaignsRepository.isSending(claimed)).toBe(true);
    });

    it("never gives the same copy to two senders", async () => {
      const campaign = await draft();
      const first = await giver({ email: "a@example.org" });
      const second = await giver({ email: "b@example.org", idCode: null });
      await emailCampaignsRepository.queue(campaign.id, [first.id, second.id]);
      await emailCampaignsRepository.claimSending(campaign.id, "sender");

      const taken = await Promise.all([
        emailSendsRepository.claimNext(campaign.id, "sender"),
        emailSendsRepository.claimNext(campaign.id, "sender"),
        emailSendsRepository.claimNext(campaign.id, "sender"),
      ]);

      const donorIds = taken.flatMap((copy) => (copy ? [copy.donorId] : []));
      expect(donorIds.sort()).toEqual([first.id, second.id].sort());
    });

    it("is sent once nothing is queued, and stays to be continued otherwise", async () => {
      const campaign = await draft();
      const first = await giver({ email: "a@example.org" });
      const second = await giver({ email: "b@example.org", idCode: null });
      await emailCampaignsRepository.queue(campaign.id, [first.id, second.id]);
      await emailCampaignsRepository.claimSending(campaign.id, "first");

      const copy = await emailSendsRepository.claimNext(campaign.id, "first");
      if (copy) await emailSendsRepository.markSent(copy.id);
      await emailCampaignsRepository.finishSending(campaign.id, "first");
      const cutOff = await emailCampaignsRepository.findById(campaign.id);
      expect(cutOff?.status).toBe("sending");
      expect(cutOff && EmailCampaignsRepository.isSending(cutOff)).toBe(false);

      await emailCampaignsRepository.claimSending(campaign.id, "second");
      const rest = await emailSendsRepository.claimNext(campaign.id, "second");
      if (rest) await emailSendsRepository.markSent(rest.id);
      await emailCampaignsRepository.finishSending(campaign.id, "second");
      const sent = await emailCampaignsRepository.findById(campaign.id);
      expect(sent?.status).toBe("sent");
      expect(sent?.sentAt).toBeInstanceOf(Date);
    });

    it("queues again the copies that didn't go out, the failed ones only when asked", async () => {
      const campaign = await draft();
      const donors = await Promise.all(
        ["a", "b", "c", "d"].map((name) =>
          giver({ email: `${name}@example.org`, idCode: null }),
        ),
      );
      await emailCampaignsRepository.queue(
        campaign.id,
        donors.map((donor) => donor.id),
      );
      await emailCampaignsRepository.claimSending(campaign.id, "sender");
      const [sent, failed, cutOff] = [
        await emailSendsRepository.claimNext(campaign.id, "sender"),
        await emailSendsRepository.claimNext(campaign.id, "sender"),
        await emailSendsRepository.claimNext(campaign.id, "sender"),
      ];
      // The fourth is claimed and never sent: its sender stopped first.
      await emailSendsRepository.claimNext(campaign.id, "sender");
      if (sent) await emailSendsRepository.markSent(sent.id);
      if (failed) {
        await emailSendsRepository.markFailed(
          failed.id,
          campaign.id,
          "sender",
          "Mailbox full",
        );
      }
      // May have gone out: never queued again.
      if (cutOff) {
        await emailSendsRepository.markSending(
          cutOff.id,
          campaign.id,
          "sender",
        );
      }

      // Going on: the one claimed but not sent goes again
      await emailSendsRepository.requeueUnsent(campaign.id, { failed: false });
      expect(await emailSendsRepository.countByStatus(campaign.id)).toEqual({
        queued: 1,
        sending: 1,
        sent: 1,
        failed: 1,
        skipped: 0,
      });

      // The team asking to try the failed ones again: they go too
      await emailSendsRepository.requeueUnsent(campaign.id, { failed: true });
      expect(await emailSendsRepository.countByStatus(campaign.id)).toEqual({
        queued: 2,
        sending: 1,
        sent: 1,
        failed: 0,
        skipped: 0,
      });
    });

    it("deletes an email only while it's a draft", async () => {
      const kept = await draft();
      await emailCampaignsRepository.queue(kept.id, []);
      expect(await emailCampaignsRepository.removeDraft(kept.id)).toBe(false);
      expect(await emailCampaignsRepository.findById(kept.id)).toBeDefined();

      const gone = await draft();
      expect(await emailCampaignsRepository.removeDraft(gone.id)).toBe(true);
    });

    it("finds emails cut off while being sent, and only those", async () => {
      const cutOff = await draft();
      const running = await draft();
      await draft();
      for (const campaign of [cutOff, running]) {
        await emailCampaignsRepository.queue(campaign.id, []);
        await emailCampaignsRepository.claimSending(campaign.id, "a");
      }
      await db
        .update(emailCampaigns)
        .set({ heartbeatAt: new Date(Date.now() - 60 * 60 * 1000) })
        .where(eq(emailCampaigns.id, cutOff.id));

      const found = await emailCampaignsRepository.findCutOff();
      expect(found.map((campaign) => campaign.id)).toEqual([cutOff.id]);
    });

    it("stops a sender that stalled until another took over", async () => {
      const campaign = await draft();
      const donor = await giver({ email: "a@example.org" });
      await emailCampaignsRepository.queue(campaign.id, [donor.id]);
      await emailCampaignsRepository.claimSending(campaign.id, "stalled");
      const copy = await emailSendsRepository.claimNext(campaign.id, "stalled");
      if (!copy) throw new Error("Nothing was claimed");
      await db
        .update(emailCampaigns)
        .set({ heartbeatAt: new Date(Date.now() - 60 * 60 * 1000) })
        .where(eq(emailCampaigns.id, campaign.id));

      // Another process takes over, and puts the claimed copy back.
      expect(
        await emailCampaignsRepository.claimSending(campaign.id, "next"),
      ).toBe(true);
      await emailSendsRepository.requeueUnsent(campaign.id, { failed: false });

      // The new sender has the copy, and the stalled one wakes up: it may
      // send nothing more, nor mark the copy failed or skipped.
      expect(
        (await emailSendsRepository.claimNext(campaign.id, "next"))?.id,
      ).toBe(copy.id);
      await emailSendsRepository.markFailed(
        copy.id,
        campaign.id,
        "stalled",
        "Couldn't read the donor",
      );
      await emailSendsRepository.markSkipped(copy.id, campaign.id, "stalled");
      expect(
        await emailSendsRepository.markSending(copy.id, campaign.id, "stalled"),
      ).toBe(false);
      expect(await emailCampaignsRepository.beat(campaign.id, "stalled")).toBe(
        false,
      );
      expect(
        await emailSendsRepository.claimNext(campaign.id, "stalled"),
      ).toBeUndefined();
      await emailCampaignsRepository.finishSending(campaign.id, "stalled");
      const still = await emailCampaignsRepository.findById(campaign.id);
      expect(still?.senderId).toBe("next");

      // The new sender goes on with the copy as it was
      expect(
        await emailSendsRepository.markSending(copy.id, campaign.id, "next"),
      ).toBe(true);
    });

    it("leaves out a save that arrives after a later one from the same editor", async () => {
      const campaign = await draft();
      const save = (name: string, editor?: string, number = 0) =>
        emailCampaignsRepository.updateDraft(
          campaign.id,
          { name },
          editor ? { editor, number } : undefined,
        );
      expect(await save("Later", "tab-a", 2)).toBeDefined();
      expect(await save("Earlier", "tab-a", 1)).toBeUndefined();
      expect((await emailCampaignsRepository.findById(campaign.id))?.name).toBe(
        "Later",
      );
      // Another editor's save counts, whatever its number
      expect(await save("Other tab", "tab-b", 1)).toBeDefined();
      expect(await save("Next", "tab-a", 3)).toBeDefined();
      // An editor that numbers none still saves
      expect(await save("Unnumbered")).toBeDefined();
    });

    it("changes an email only while it's a draft", async () => {
      const campaign = await draft();
      expect(
        (await emailCampaignsRepository.updateDraft(campaign.id, { name: "A" }))
          ?.name,
      ).toBe("A");

      await emailCampaignsRepository.queue(campaign.id, []);

      expect(
        await emailCampaignsRepository.updateDraft(campaign.id, { name: "B" }),
      ).toBeUndefined();
      expect((await emailCampaignsRepository.findById(campaign.id))?.name).toBe(
        "A",
      );
    });

    it("sends only the draft that was checked", async () => {
      const campaign = await draft();
      // Its name isn't in the email: a new one changes nothing that goes out
      await emailCampaignsRepository.updateDraft(campaign.id, { name: "B" });
      const named = await emailCampaignsRepository.findById(campaign.id);
      await emailCampaignsRepository.updateDraft(campaign.id, {
        content: {
          ...campaign.content,
          subject: { et: "Uus", en: "New" },
        },
      });

      // Changed since it was checked
      expect(
        named && (await emailCampaignsRepository.queue(campaign.id, [], named)),
      ).toBe(false);
      const latest = await emailCampaignsRepository.findById(campaign.id);
      expect(
        latest &&
          (await emailCampaignsRepository.queue(campaign.id, [], latest)),
      ).toBe(true);
    });

    it("keeps the time it was first sent when failed copies are retried", async () => {
      const campaign = await draft();
      const first = await giver({ email: "a@example.org" });
      const second = await giver({ email: "b@example.org", idCode: null });
      await emailCampaignsRepository.queue(campaign.id, [first.id, second.id]);
      await emailCampaignsRepository.claimSending(campaign.id, "first");
      const a = await emailSendsRepository.claimNext(campaign.id, "first");
      const b = await emailSendsRepository.claimNext(campaign.id, "first");
      if (a) await emailSendsRepository.markSent(a.id);
      if (b) {
        await emailSendsRepository.markFailed(
          b.id,
          campaign.id,
          "first",
          "Mailbox full",
        );
      }
      await emailCampaignsRepository.finishSending(campaign.id, "first");
      const sentAt = (await emailCampaignsRepository.findById(campaign.id))
        ?.sentAt;
      expect(sentAt).toBeInstanceOf(Date);
      // Now, not hours off in some other time zone
      expect(Math.abs((sentAt?.getTime() ?? 0) - Date.now())).toBeLessThan(
        60 * 1000,
      );

      await emailCampaignsRepository.claimSending(campaign.id, "retry");
      await emailSendsRepository.requeueUnsent(campaign.id, { failed: true });
      const again = await emailSendsRepository.claimNext(campaign.id, "retry");
      if (again) await emailSendsRepository.markSent(again.id);
      await emailCampaignsRepository.finishSending(campaign.id, "retry");

      const retried = await emailCampaignsRepository.findById(campaign.id);
      expect(retried?.status).toBe("sent");
      expect(retried?.sentAt).toEqual(sentAt);
    });

    it("lists emails with their times as moments", async () => {
      const before = Date.now();
      await draft();
      const [listed] = await emailCampaignsRepository.findAll();
      expect(listed?.createdAt).toBeInstanceOf(Date);
      expect(
        Math.abs((listed?.createdAt.getTime() ?? 0) - before),
      ).toBeLessThan(60 * 1000);
    });

    it("finds a queued copy's recipient only while they still want the email", async () => {
      const donor = await giver({ email: "a@example.org" });
      expect(
        await emailCampaignsRepository.findRecipient("newsletter", donor.id),
      ).toMatchObject({ donorId: donor.id });

      await donorsRepository.updateEmailPreferences(donor.id, {
        newsletter: false,
      });

      expect(
        await emailCampaignsRepository.findRecipient("newsletter", donor.id),
      ).toBeUndefined();
    });
  });
});

describe("DonorsRepository email settings", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("changes every row with the donor's address, in any letter case", async () => {
    const one = await createTestDonor({ email: "Mari@Example.org" });
    const two = await createTestDonor({
      email: "mari@example.org ",
      idCode: null,
    });
    const other = await createTestDonor({
      email: "jaan@example.org",
      idCode: null,
    });

    const changed = await donorsRepository.updateEmailPreferences(one.id, {
      newsletter: false,
    });

    expect(changed?.id).toBe(one.id);
    expect((await donorsRepository.findById(two.id))?.newsletter).toBe(false);
    expect((await donorsRepository.findById(other.id))?.newsletter).toBe(true);
  });

  it("leaves the time of the last change when nothing changes", async () => {
    const donor = await createTestDonor({ email: "a@example.org" });
    const changed = await donorsRepository.updateEmailPreferences(donor.id, {
      newsletter: false,
    });
    const changedAt = changed?.emailPreferencesUpdatedAt;
    expect(changedAt).toBeInstanceOf(Date);

    for (const same of [{}, { newsletter: false }]) {
      const again = await donorsRepository.updateEmailPreferences(
        donor.id,
        same,
      );
      expect(again?.emailPreferencesUpdatedAt).toEqual(changedAt);
    }
    expect(
      (
        await donorsRepository.updateEmailPreferences(donor.id, {
          newsletter: false,
          yearlyEmails: false,
        })
      )?.yearlyEmails,
    ).toBe(false);
  });

  it("changes only the donor itself when it has no address", async () => {
    const one = await createTestDonor({ email: "" });
    const two = await createTestDonor({ email: "", idCode: null });

    await donorsRepository.updateEmailPreferences(one.id, {
      newsletter: false,
    });

    expect((await donorsRepository.findById(one.id))?.newsletter).toBe(false);
    expect((await donorsRepository.findById(two.id))?.newsletter).toBe(true);
  });

  it("sets the newsletter choice from a donation only where it differs", async () => {
    const one = await createTestDonor({ email: "a@example.org" });
    await createTestDonor({
      email: "A@example.org",
      idCode: null,
      newsletter: false,
    });

    expect(await donorsRepository.setNewsletter(one.id, true)).toBe(1);
    expect(await donorsRepository.setNewsletter(one.id, true)).toBe(0);
    expect(await donorsRepository.setNewsletter(one.id, false)).toBe(2);
    // Off from a donation: a later donation can turn it on again.
    expect(await donorsRepository.setNewsletter(one.id, true)).toBe(2);
  });

  it("takes turning off a newsletter that's off already as the donor's own choice", async () => {
    const donor = await createTestDonor({ email: "a@example.org" });
    // Unticked on a donation, then the unsubscribe button in a newsletter
    expect(await donorsRepository.setNewsletter(donor.id, false)).toBe(1);
    await donorsRepository.updateEmailPreferences(donor.id, {
      newsletter: false,
    });

    // A later donation's "yes" doesn't turn it back on
    expect(await donorsRepository.setNewsletter(donor.id, true)).toBe(0);
    expect((await donorsRepository.findById(donor.id))?.newsletter).toBe(false);
  });

  it("never turns the newsletter back on that was turned off in the settings", async () => {
    const one = await createTestDonor({ email: "a@example.org" });
    const two = await createTestDonor({
      email: "A@example.org",
      idCode: null,
    });
    await donorsRepository.updateEmailPreferences(two.id, {
      newsletter: false,
    });

    expect(await donorsRepository.setNewsletter(one.id, true)).toBe(0);
    expect((await donorsRepository.findById(one.id))?.newsletter).toBe(false);

    // The settings themselves can, and then a donation's choice counts again.
    await donorsRepository.updateEmailPreferences(one.id, { newsletter: true });
    expect(await donorsRepository.setNewsletter(one.id, false)).toBe(2);
    expect(await donorsRepository.setNewsletter(one.id, true)).toBe(2);
  });

  it("counts a no at once, cancelling a yes still waiting for payment", async () => {
    const donor = await createTestDonor({ email: "a@example.org" });
    // A one-off donation's "yes", not paid yet
    const waiting = await createTestDonation({
      donorId: donor.id,
      finalized: false,
      newsletter: true,
    });

    // A later "no" that changes nothing still overrules it
    expect(await donorsRepository.setNewsletter(donor.id, false)).toBe(1);
    expect(
      (await donationsRepository.findById(waiting.id))?.newsletter,
    ).toBeNull();
    expect(await donorsRepository.setNewsletter(donor.id, false)).toBe(0);
  });

  it("keeps a waiting yes when only other emails change", async () => {
    const donor = await createTestDonor({
      email: "a@example.org",
      newsletter: false,
    });
    const waiting = await createTestDonation({
      donorId: donor.id,
      finalized: false,
      newsletter: true,
    });

    await donorsRepository.updateEmailPreferences(donor.id, {
      yearlyEmails: false,
    });

    expect((await donationsRepository.findById(waiting.id))?.newsletter).toBe(
      true,
    );
    // Paid: it counts
    expect(await donorsRepository.setNewsletter(donor.id, true)).toBe(1);
  });

  it("finds an address's settings as sending decides them", async () => {
    // Two rows that gave, one with the newsletter off, and one that never did
    const one = await giver({ email: "mari@example.org" });
    await giver({ email: "MARI@example.org", idCode: null });
    const notGiven = await createTestDonor({
      email: "mari@example.org",
      idCode: null,
      newsletter: false,
    });
    await donorsRepository.update(one.id, { yearlyEmails: false });

    expect(
      await donorsRepository.findEmailPreferences(notGiven.id),
    ).toMatchObject({
      newsletter: true,
      transferEmails: true,
      yearlyEmails: false,
    });
    expect(await donorsRepository.findEmailPreferences(99999)).toBeUndefined();
  });

  it("keeps an address's settings for a new row of it, given before it first gave", async () => {
    // A standing order not paid yet, and the newsletter turned off meanwhile
    const unpaid = await createTestDonor({ email: "mari@example.org" });
    await donorsRepository.updateEmailPreferences(unpaid.id, {
      newsletter: false,
    });

    // A donation that makes a row of its own, the address typed otherwise
    const second = await donorsRepository.create({
      email: "Mari@Example.org",
      idCode: null,
    });
    await createTestDonation({ donorId: second.id });

    expect(second).toMatchObject({
      newsletter: false,
      newsletterSource: "settings",
    });
    expect(
      (await donorsRepository.findEmailPreferences(second.id))?.newsletter,
    ).toBe(false);
    expect(
      await emailCampaignsRepository.findRecipients("newsletter", {}),
    ).toEqual([]);
    // A paid "yes" from a donation form doesn't turn it back on
    expect(await donorsRepository.setNewsletter(second.id, true)).toBe(0);

    // A new address starts with every email on
    expect(
      await donorsRepository.create({ email: "jaan@example.org" }),
    ).toMatchObject({
      newsletter: true,
      transferEmails: true,
      yearlyEmails: true,
      newsletterSource: "default",
    });
  });

  it("keeps the language chosen for a new row of the address", async () => {
    const first = await giver({ email: "mari@example.org" });
    await donorsRepository.updateEmailPreferences(first.id, {
      emailLocale: "en",
    });
    expect(
      (await donorsRepository.findEmailPreferences(first.id))?.emailLocale,
    ).toBe("en");

    const second = await donorsRepository.create({
      email: "Mari@Example.org",
      idCode: null,
    });
    expect(second.emailLocale).toBe("en");
    expect(
      (await donorsRepository.create({ email: "jaan@example.org" }))
        .emailLocale,
    ).toBeNull();
  });

  it("takes a language chosen again as no change", async () => {
    const donor = await createTestDonor({ email: "a@example.org" });
    const changed = await donorsRepository.updateEmailPreferences(donor.id, {
      emailLocale: "en",
    });
    const again = await donorsRepository.updateEmailPreferences(donor.id, {
      emailLocale: "en",
    });
    expect(again?.emailPreferencesUpdatedAt).toEqual(
      changed?.emailPreferencesUpdatedAt,
    );
  });

  it("tells the settings page what sending decides, address by address", async () => {
    // Off on a row that gave, and on on one that didn't
    const off = await giver({ email: "off@example.org", newsletter: false });
    await createTestDonor({ email: "OFF@example.org", idCode: null });
    // On where it gave, off where it never did
    const on = await giver({ email: "on@example.org" });
    await createTestDonor({
      email: "on@example.org",
      idCode: null,
      newsletter: false,
    });
    // Two rows that both gave, one with it off
    const mixed = await giver({ email: "mixed@example.org" });
    await giver({
      email: "Mixed@example.org",
      idCode: null,
      newsletter: false,
    });

    const sentTo = new Set(
      (await emailCampaignsRepository.findRecipients("newsletter", {})).map(
        (r) => r.email.toLowerCase(),
      ),
    );
    for (const donor of [off, on, mixed]) {
      const shown = await donorsRepository.findEmailPreferences(donor.id);
      expect(shown?.newsletter).toBe(sentTo.has(donor.email ?? ""));
    }
    expect([...sentTo]).toEqual(["on@example.org"]);
  });

  it("says who set the newsletter as the address has it", async () => {
    const first = await giver({ email: "mari@example.org" });
    const source = async () =>
      (await donorsRepository.findEmailPreferences(first.id))?.newsletterSource;
    expect(await source()).toBe("default");

    await donorsRepository.setNewsletter(first.id, false);
    expect(await source()).toBe("donation");

    await donorsRepository.updateEmailPreferences(first.id, {
      newsletter: true,
    });
    await donorsRepository.updateEmailPreferences(first.id, {
      newsletter: false,
    });
    expect(await source()).toBe("settings");

    // A later row of the address, and a change to only the yearly emails,
    // which touches both rows: the row that's off still says why.
    await giver({ email: "Mari@example.org", idCode: null });
    await donorsRepository.updateEmailPreferences(first.id, {
      yearlyEmails: false,
    });
    expect(await source()).toBe("settings");
  });
});
