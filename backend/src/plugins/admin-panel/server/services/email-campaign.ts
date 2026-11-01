/**
 * The emails the team writes in the admin panel and sends to a group of
 * donors: who they go to, what's wrong with them, how one looks to a donor,
 * and sending, one donor at a time, in the background.
 */
import { randomUUID } from "node:crypto";
import type { Core } from "@strapi/strapi";
import {
  emailCampaignsRepository,
  emailSendsRepository,
} from "../../../../db/repositories";
import { EmailCampaignsRepository } from "../../../../db/repositories/email-campaigns.repository";
import type { EmailCampaign } from "../../../../db/schema";
import {
  campaignFrames,
  campaignMessage,
  layOutCampaignEmail,
  sendCampaignEmail,
  sendFailure,
} from "../../../../emails";
import {
  DEFAULT_TAX_RATE,
  EMAIL_KINDS,
  exampleOf,
  hasTraits,
  imagesIn,
  isAddress,
  isEmptyFor,
  lint,
  renderEmail,
  type AudienceFilters,
  type CampaignContent,
  type EmailKind,
  type Issue,
  type OrganizationName,
  type Recipient,
  type RenderContext,
  type Trait,
} from "../../../../utils/email-campaign";
import type { ImageType } from "../../../../utils/email-image";
import { LOCALES, toLocale, type Locale } from "../../../../utils/locale";
import { oneOf } from "../../../../utils/narrow";
import {
  emailService,
  mediaLibrary,
  strapiTable,
  type MailMessage,
} from "../../../../strapi-internals";
import { tipOrganizationInternalId } from "../utils/tip-organization";

/**
 * The pause between two emails. Brevo would take them faster, but a steady
 * pace is kinder to the spam filters of the inboxes they land in.
 */
const PAUSE_MS = 300;

/** How many of the group the editor lists. */
const LISTED = 100;

const pause = () => new Promise((resolve) => setTimeout(resolve, PAUSE_MS));

/**
 * How many addresses refused one after another stop sending, to go on
 * later: more likely the mail server's trouble, such as a limit, than as
 * many bad addresses.
 */
const REFUSED_IN_A_ROW = 3;

/**
 * How long a copy whose address the mail server refused for now waits to be
 * tried again, after its first refusal and its second: what greylisting
 * asks for, then time for a full mailbox to be emptied. The third fails it.
 */
const RETRY_MINUTES = [15, 60];

/**
 * The sending loops running in this process, and whether it's shutting
 * down: then each loop stops before its next copy, so no copy is cut off
 * while it's handed to the mail server, and no new sending starts.
 */
const loops = new Set<Promise<void>>();
let shuttingDown = false;

/** How long shutting down waits for a copy being handed over. */
const STOP_WAIT_MS = 10 * 1000;

/**
 * Stop sending in this process, for it to shut down: each loop finishes the
 * copy in hand and stops, leaving the rest for another process to go on
 * with (EmailCampaignsService.resumeCutOff).
 */
export async function stopSending(): Promise<void> {
  shuttingDown = true;
  await Promise.race([
    Promise.allSettled(loops),
    new Promise((resolve) => setTimeout(resolve, STOP_WAIT_MS)),
  ]);
}

/** A stored kind, which only this code writes. */
export function kindOf(campaign: EmailCampaign): EmailKind {
  return oneOf(campaign.kind, EMAIL_KINDS) ?? "newsletter";
}

/** What went wrong, for the list of failed copies. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Someone to show an email with no one in its group as, from the examples,
 * in the group's language.
 */
function exampleRecipient(audience: AudienceFilters): Recipient {
  return {
    donorId: 0,
    email: "",
    firstName: exampleOf("firstName"),
    lastName: exampleOf("lastName"),
    idCode: null,
    locale: audience.locale ?? "et",
    recurring: false,
  };
}

export function createEmailCampaignService(strapi: Core.Strapi) {
  /**
   * Every organization's name and cause in each language, as the site shows
   * them, or as their draft for one taken off it. A language without its own
   * gets the Estonian.
   */
  async function organizationNames() {
    const find = (locale: Locale, status: "draft" | "published") =>
      strapi.documents("api::organization.organization").findMany({
        locale,
        status,
        fields: ["title", "internalId"],
        populate: { cause: { fields: ["title"] } },
        limit: 1000,
      });
    // Each language's drafts, then what's published over them, all asked
    // for at once.
    const found = await Promise.all(
      LOCALES.map(async (locale) => ({
        locale,
        lists: await Promise.all([
          find(locale, "draft"),
          find(locale, "published"),
        ]),
      })),
    );
    const names = new Map<Locale, Map<string, OrganizationName>>();
    for (const { locale, lists } of found) {
      const inLocale = new Map<string, OrganizationName>();
      for (const organization of lists.flat()) {
        if (!organization.internalId || !organization.title) continue;
        inLocale.set(organization.internalId, {
          title: organization.title,
          cause: organization.cause?.title ?? null,
        });
      }
      names.set(locale, inLocale);
    }
    return (internalId: string, locale: Locale) =>
      names.get(locale)?.get(internalId) ??
      names.get("et")?.get(internalId) ??
      null;
  }

  /** The widths the media library has for an email's pictures. */
  async function pictureWidths(content: CampaignContent) {
    const urls = [
      ...new Set(
        content.blocks.flatMap((block) =>
          [block.text.et, block.text.en].flatMap((text) =>
            imagesIn(text).map((image) => image.url),
          ),
        ),
      ),
    ];
    const files = urls.length
      ? await strapiTable<{ url: string; width: number | null }>(
          strapi,
          "plugin::upload.file",
        ).findMany({ select: ["url", "width"], where: { url: { $in: urls } } })
      : [];
    const widths = new Map(
      files.flatMap((file) => (file.width ? [[file.url, file.width]] : [])),
    );
    return (url: string) => widths.get(url) ?? null;
  }

  /** What an email's variables and pictures need besides the donor. */
  async function renderContext(
    content: CampaignContent,
  ): Promise<RenderContext> {
    const [organization, supportOrganization, pictureWidth] = await Promise.all(
      [
        organizationNames(),
        tipOrganizationInternalId(strapi),
        pictureWidths(content),
      ],
    );
    return {
      organization,
      supportOrganization,
      taxRate: content.taxRate ?? DEFAULT_TAX_RATE,
      pictureWidth,
    };
  }

  /**
   * Send an email's queued copies, one at a time, as the process that
   * claimed it. Each copy goes to its donor's address as it is now, unless
   * they've turned that kind of email off since it was queued.
   *
   * A copy that can't go to its donor, as one whose address the mail
   * server refused for good, is marked failed, and sending goes on: the
   * team can try the failed ones again. One whose address it refused for
   * now waits to be tried again (RETRY_MINUTES), and fails the third time.
   *
   * When the mail server itself fails, as by refusing the sign-in, saying
   * to try again later or not being reached, it would fail every copy the
   * same way: sending stops and waits for the team, as it does after
   * address after address is refused. Going on by itself, every minute,
   * would only use up the copies' tries until all had failed. The copy
   * the server surely didn't take goes back in the queue, as it was. One
   * it has taken, or may have, as when the connection was lost while
   * waiting for its reply, is never marked failed, even if saving that it
   * was sent fails: it stays at 'sending', which is never sent again.
   *
   * Anything else that stops a copy before it's sent, as a CMS that can't
   * be read, stops sending, to go on by itself later: the copy goes back in
   * the queue, behind those not tried yet, and fails the third time, as one
   * that can't be made shouldn't hold up the rest.
   *
   * Should sending stop between claiming a copy and sending it, the copy
   * stays 'claimed' and is queued again when sending goes on. A process
   * that stalls for so long that another takes over stops before it sends
   * anything more: it's no longer the email's sender (`senderId`).
   */
  async function run(
    campaign: EmailCampaign,
    kind: EmailKind,
    senderId: string,
  ) {
    const frames = campaignFrames(strapi);
    // Addresses refused one after another, which looks like the server's
    // trouble rather than theirs: sending then waits for the team.
    let refusedInARow = 0;
    let heldFor: string | null = null;
    try {
      const context = await renderContext(campaign.content);
      for (;;) {
        if (shuttingDown) break;
        const copy = await emailSendsRepository.claimNext(
          campaign.id,
          senderId,
        );
        if (!copy) break;
        // Another process took over: this one stalled for longer than a
        // heartbeat lasts. The copy it claimed goes back in the queue when
        // the email is next taken up.
        if (!(await emailCampaignsRepository.beat(campaign.id, senderId))) {
          break;
        }
        // What's wrong with this donor's copy alone fails it, and sending
        // goes on. Anything else before it's sent would most likely be the
        // next copy's too, as a CMS that can't be read: the copy goes back
        // in the queue, and sending stops, to go on later.
        const stop = async (error: unknown) => {
          await emailSendsRepository.putBack(
            copy.id,
            campaign.id,
            senderId,
            messageOf(error),
          );
          strapi.log.error(
            `Sending email ${campaign.id} stopped, to go on later: ${messageOf(error)}`,
          );
        };
        const fail = (why: string) =>
          emailSendsRepository.markFailed(copy.id, campaign.id, senderId, why);

        let message: MailMessage;
        try {
          const recipient = await emailCampaignsRepository.findRecipient(
            kind,
            copy.donorId,
            campaign.audience,
          );
          if (!recipient) {
            await emailSendsRepository.markSkipped(
              copy.id,
              campaign.id,
              senderId,
            );
            continue;
          }
          if (!isAddress(recipient.email)) {
            await fail("Not an email address");
            continue;
          }
          // The check stops an email some donor would get empty, but what a
          // donor is can change before their copy goes out.
          if (isEmptyFor(campaign.content, recipient, context)) {
            await fail("No block of the email is for this donor now");
            continue;
          }
          message = await campaignMessage(
            strapi,
            {
              to: recipient.email,
              ...renderEmail(campaign.content, recipient, context),
              locale: recipient.locale,
              donorId: recipient.donorId,
              kind,
            },
            frames,
          );
        } catch (error) {
          await stop(error);
          break;
        }

        if (
          !(await emailSendsRepository.markSending(
            copy.id,
            campaign.id,
            senderId,
          ))
        ) {
          break;
        }
        try {
          await emailService(strapi).send(message);
        } catch (error) {
          const failure = sendFailure(error);
          if (failure === "refused" || failure === "deferred") {
            if (failure === "refused") {
              await fail(messageOf(error));
            } else {
              await emailSendsRepository.putBack(
                copy.id,
                campaign.id,
                senderId,
                messageOf(error),
                { retryInMinutes: RETRY_MINUTES[copy.attempts] ?? 60 },
              );
            }
            // A copy tried before, as one refused for now the last time, was
            // refused before too: that says nothing new about the server.
            if (copy.attempts === 0) refusedInARow += 1;
            if (refusedInARow >= REFUSED_IN_A_ROW) {
              heldFor = `${REFUSED_IN_A_ROW} addresses in a row were refused, the last with: ${messageOf(error)}`;
              strapi.log.error(
                `Sending email ${campaign.id} stopped, to wait for the team: ${heldFor}`,
              );
              break;
            }
            await pause();
            continue;
          }
          // The mail server's trouble, not the copy's
          if (failure === "notTaken") {
            await emailSendsRepository.putBack(
              copy.id,
              campaign.id,
              senderId,
              messageOf(error),
              { tried: false },
            );
            heldFor = `the mail server didn't take a copy: ${messageOf(error)}`;
          } else {
            strapi.log.warn(
              `Email ${campaign.id}'s copy to donor ${copy.donorId} may have gone out, and isn't sent again: ${messageOf(error)}`,
            );
            heldFor = `the mail server didn't answer whether it took a copy: ${messageOf(error)}`;
          }
          strapi.log.error(
            `Sending email ${campaign.id} stopped, to wait for the team: ${heldFor}`,
          );
          break;
        }
        await emailSendsRepository.markSent(copy.id);
        refusedInARow = 0;
        await pause();
      }
    } catch (error) {
      strapi.log.error(
        `Sending email ${campaign.id} stopped: ${String(error)}`,
      );
    } finally {
      // Sent once nothing is queued; otherwise it stays to be continued.
      await emailCampaignsRepository
        .finishSending(campaign.id, senderId, heldFor)
        .catch((error: unknown) =>
          strapi.log.error(
            `Email ${campaign.id} couldn't be marked as done: ${String(error)}`,
          ),
        );
    }
  }

  return {
    /**
     * What stops an email from going to `recipients`, found as the editor's
     * check finds it: with the organizations, the support and the pictures
     * its traits and variables need.
     */
    async errors(
      kind: EmailKind,
      content: CampaignContent,
      audience: AudienceFilters,
      recipients: Recipient[],
    ): Promise<Issue[]> {
      const context = await renderContext(content);
      return lint(content, kind, recipients, audience, context).filter(
        (issue) => issue.severity === "error",
      );
    },

    /**
     * Who an email would go to, what's wrong with it, a few of them, and how
     * many of them each block reaches.
     */
    async check(
      kind: EmailKind,
      content: CampaignContent,
      audience: AudienceFilters,
    ) {
      const recipients = await emailCampaignsRepository.findRecipients(
        kind,
        audience,
      );
      const context = await renderContext(content);
      return {
        reach: content.blocks.map((block) => ({
          id: block.id,
          count: recipients.filter((r) => hasTraits(r, block.traits, context))
            .length,
        })),
        count: recipients.length,
        recipients: recipients.slice(0, LISTED).map((recipient) => ({
          donorId: recipient.donorId,
          name: [recipient.firstName, recipient.lastName]
            .filter(Boolean)
            .join(" "),
          email: recipient.email,
          locale: recipient.locale,
        })),
        issues: lint(content, kind, recipients, audience, context),
      };
    },

    /**
     * The email as a donor in its group gets it, laid out: the one asked
     * for, or the first who is what `traits` asks, or the first, or someone
     * made up when the group is empty. Also how many are what it asks.
     */
    async preview(
      kind: EmailKind,
      content: CampaignContent,
      audience: AudienceFilters,
      donorId: number | null,
      locale: string | null,
      traits: Partial<Record<Trait, boolean>> = {},
    ) {
      const recipients = await emailCampaignsRepository.findRecipients(
        kind,
        audience,
      );
      const context = await renderContext(content);
      const matching = recipients.filter((r) => hasTraits(r, traits, context));
      const found =
        recipients.find((r) => r.donorId === donorId) ??
        matching[0] ??
        recipients[0] ??
        exampleRecipient(audience);
      // The same donor in the other language, to check both.
      const recipient = locale ? { ...found, locale: toLocale(locale) } : found;
      const email = renderEmail(content, recipient, context);
      // Shown to the team: its link to the page for choosing emails is to
      // no one's, as a test's is.
      const laidOut = await layOutCampaignEmail(strapi, {
        html: email.html,
        text: email.text,
        locale: recipient.locale,
        donorId: null,
      });
      return {
        donorId: recipient.donorId || null,
        locale: recipient.locale,
        subject: email.subject,
        html: laidOut.html,
        matching: matching.length,
      };
    },

    /**
     * The email as a donor in its group gets it, sent to `to` instead. Its
     * link to the page for choosing emails shows no one's choices: the first
     * donor's would show their address to whoever opens the test.
     */
    async sendTest(campaign: EmailCampaign, kind: EmailKind, to: string) {
      const [recipient] = await emailCampaignsRepository.findRecipients(
        kind,
        campaign.audience,
      );
      const as = recipient ?? exampleRecipient(campaign.audience);
      const email = renderEmail(
        campaign.content,
        as,
        await renderContext(campaign.content),
      );
      await sendCampaignEmail(strapi, {
        to,
        ...email,
        subject: `[Test] ${email.subject}`,
        locale: as.locale,
        donorId: null,
        kind,
      });
    },

    /**
     * Start sending, in the background. A draft's group is queued first, and
     * is the group for good: `recipients` when the caller has just found it,
     * so it isn't looked up twice. An email whose sending was cut off goes on
     * with what's queued; one that's been sent with failed copies tries them
     * again. `resumed` when it goes on by itself, as after a deploy, which
     * an email held for the team doesn't. Nothing starts while another
     * process is sending it. False when a draft wasn't queued: it was
     * changed since it was read, and checked, or someone else started it
     * first.
     */
    async start(
      campaign: EmailCampaign,
      kind: EmailKind,
      {
        recipients,
        resumed = false,
      }: { recipients?: Recipient[]; resumed?: boolean } = {},
    ): Promise<boolean> {
      if (campaign.status === "draft") {
        const group =
          recipients ??
          (await emailCampaignsRepository.findRecipients(
            kind,
            campaign.audience,
          ));
        const queued = await emailCampaignsRepository.queue(
          campaign.id,
          group.map((recipient) => recipient.donorId),
          campaign,
        );
        if (!queued) return false;
      } else if (campaign.status === "sent") {
        const { failed } = await emailSendsRepository.countByStatus(
          campaign.id,
        );
        // All sent, or skipped: nothing to go on with.
        if (failed === 0) return true;
      }
      // An email still at 'sending' that no process is sending was cut off,
      // perhaps after its last copy: going on finishes it, even with nothing
      // left to send.
      // A process shutting down leaves it to another.
      if (shuttingDown) return true;
      const senderId = randomUUID();
      if (
        !(await emailCampaignsRepository.claimSending(campaign.id, senderId, {
          resumed,
        }))
      ) {
        return true;
      }
      // An email that's been sent goes on only from "Try the failed ones
      // again": failed copies are queued again only then.
      await emailSendsRepository.requeueUnsent(campaign.id, {
        failed: campaign.status === "sent",
      });
      const loop = run(campaign, kind, senderId);
      loops.add(loop);
      void loop.finally(() => loops.delete(loop));
      return true;
    },

    /**
     * A picture for an email, into the media library, under a name of our
     * own: its address. `type` is what its bytes were found to be.
     */
    async uploadImage(
      file: { path: string; size: number },
      type: ImageType,
      description: string,
    ): Promise<{ id: number; url: string } | null> {
      const name = `email-${Date.now()}.${type.extension}`;
      const [stored] = await mediaLibrary(strapi).upload(
        {
          filepath: file.path,
          originalFilename: name,
          mimetype: type.mime,
          detectedMimeType: type.mime,
          size: file.size,
        },
        { name, alternativeText: description },
      );
      return stored ?? null;
    },

    /**
     * Go on with every email whose sending was cut off, such as by a
     * deploy, without waiting for someone to press "Continue sending".
     * Every backend process looks; one takes each email up.
     */
    async resumeCutOff() {
      for (const campaign of await emailCampaignsRepository.findCutOff()) {
        await this.start(campaign, kindOf(campaign), { resumed: true });
      }
    },

    /** How far sending an email has got. */
    async progress(campaign: EmailCampaign) {
      return {
        ...(await emailSendsRepository.countByStatus(campaign.id)),
        ...(await emailSendsRepository.findWaiting(campaign.id)),
        running: EmailCampaignsRepository.isSending(campaign),
        failures: await emailSendsRepository.findFailed(campaign.id),
        stoppedBy: await emailSendsRepository.findStopReason(campaign.id),
      };
    },
  };
}
