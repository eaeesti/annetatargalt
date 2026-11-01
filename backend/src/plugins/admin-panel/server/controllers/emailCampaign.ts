import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { emailCampaignsRepository } from "../../../../db/repositories";
import type { EmailCampaign } from "../../../../db/schema";
import {
  DEFAULT_TAX_RATE,
  EMAIL_KINDS,
  emptyContent,
  parseAudience,
  parseContent,
  parseTraits,
  TRAIT_LABELS,
  TRAITS,
  traitNeedsPeriod,
  traitNeedsYear,
  variablesFor,
  type EmailKind,
  type Recipient,
} from "../../../../utils/email-campaign";
import { idOf, isRecord, oneOf } from "../../../../utils/narrow";
import { createEmailCampaignService, kindOf } from "../services/email-campaign";
import { auditLog } from "../utils/audit-log";
import { currentUser } from "../utils/current-user";
import { uploadedFile } from "../utils/uploaded-file";
import {
  cleanDescription,
  imageType,
  MAX_IMAGE_BYTES,
} from "../../../../utils/email-image";
import { readFile } from "node:fs/promises";

/**
 * The editor saves, checks and shows the email after every pause in typing,
 * and the page of one being sent asks for it every few seconds: those are
 * logged once per person in this long, not each time, or they'd bury
 * everything else in the audit log.
 */
const AUDIT_EDITING_MINUTES = 30;

const KIND_LABELS: Record<EmailKind, string> = {
  newsletter: "Newsletter",
  transfer: "Donations passed on",
  yearly: "Yearly summary",
};

function body(ctx: Context): Record<string, unknown> {
  return isRecord(ctx.request.body) ? ctx.request.body : {};
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const service = createEmailCampaignService(strapi);

  /** The email in the URL, or a response saying why there's none. */
  async function find(ctx: Context): Promise<EmailCampaign | null> {
    const id = idOf(ctx.params.id);
    if (!id) {
      ctx.badRequest("Invalid email ID");
      return null;
    }
    const campaign = await emailCampaignsRepository.findById(id);
    if (!campaign) ctx.notFound("Email not found");
    return campaign ?? null;
  }

  return {
    async list(ctx: Context) {
      await auditLog(ctx, "emails.list");
      return ctx.send({ data: await emailCampaignsRepository.findAll() });
    },

    /** What an email can be made of, for the editor. */
    async options(ctx: Context) {
      return ctx.send({
        data: {
          kinds: EMAIL_KINDS.map((kind) => ({
            value: kind,
            label: KIND_LABELS[kind],
            variables: variablesFor(),
          })),
          traits: TRAITS.map((trait) => ({
            value: trait,
            label: TRAIT_LABELS[trait],
            needsPeriod: traitNeedsPeriod(trait),
            needsYear: traitNeedsYear(trait),
          })),
          defaultTaxRate: DEFAULT_TAX_RATE,
        },
      });
    },

    async create(ctx: Context) {
      const campaign = await emailCampaignsRepository.create({
        kind: oneOf(body(ctx).kind, EMAIL_KINDS) ?? "newsletter",
        content: emptyContent(),
        audience: {},
        createdBy: currentUser(ctx)?.email ?? null,
      });
      await auditLog(ctx, "emails.create", String(campaign.id));
      return ctx.send({ data: campaign });
    },

    async findOne(ctx: Context) {
      const campaign = await find(ctx);
      if (!campaign) return;
      // While it's sent, the page asks for it every few seconds.
      await auditLog(ctx, "emails.findOne", String(campaign.id), {
        onceWithinMinutes: AUDIT_EDITING_MINUTES,
      });
      return ctx.send({
        data: { ...campaign, progress: await service.progress(campaign) },
      });
    },

    async update(ctx: Context) {
      const campaign = await find(ctx);
      if (!campaign) return;
      if (campaign.status !== "draft") {
        return ctx.badRequest("An email can't be changed once it's sent");
      }
      const input = body(ctx);
      const content =
        input.content === undefined ? undefined : parseContent(input.content);
      if (content === null) return ctx.badRequest("Invalid content");
      const kind =
        input.kind === undefined ? undefined : oneOf(input.kind, EMAIL_KINDS);
      if (input.kind !== undefined && !kind) {
        return ctx.badRequest("Invalid kind");
      }
      // Which editor saves, and which of its saves this is
      const save =
        typeof input.editor === "string" &&
        input.editor.length <= 36 &&
        Number.isSafeInteger(input.save)
          ? { editor: input.editor, number: Number(input.save) }
          : undefined;
      const updated = await emailCampaignsRepository.updateDraft(
        campaign.id,
        {
          kind,
          name:
            typeof input.name === "string"
              ? input.name.slice(0, 256)
              : undefined,
          content,
          audience:
            input.audience === undefined
              ? undefined
              : parseAudience(input.audience),
        },
        save,
      );
      if (!updated) {
        // A later save arrived first, or sending started since it was read.
        const now = await emailCampaignsRepository.findById(campaign.id);
        return now?.status === "draft"
          ? ctx.conflict("A later save of this email arrived first")
          : ctx.badRequest("An email can't be changed once it's sent");
      }
      await auditLog(ctx, "emails.update", String(campaign.id), {
        onceWithinMinutes: AUDIT_EDITING_MINUTES,
      });
      return ctx.send({ data: updated });
    },

    async remove(ctx: Context) {
      const campaign = await find(ctx);
      if (!campaign) return;
      if (campaign.status !== "draft") {
        return ctx.badRequest("A sent email stays, as a record of it");
      }
      if (!(await emailCampaignsRepository.removeDraft(campaign.id))) {
        return ctx.conflict(
          "It started being sent just now, so it stays, as a record of it",
        );
      }
      await auditLog(ctx, "emails.remove", String(campaign.id));
      return ctx.send({ data: { id: campaign.id } });
    },

    /** A new draft with the same kind, group and text. */
    async duplicate(ctx: Context) {
      const campaign = await find(ctx);
      if (!campaign) return;
      const copy = await emailCampaignsRepository.create({
        kind: campaign.kind,
        name: campaign.name ? `${campaign.name} (copy)`.slice(0, 256) : "",
        content: campaign.content,
        audience: campaign.audience,
        createdBy: currentUser(ctx)?.email ?? null,
      });
      await auditLog(ctx, "emails.duplicate", String(campaign.id));
      return ctx.send({ data: copy });
    },

    /** The group and the issues of an email as it is in the editor. */
    async check(ctx: Context) {
      const input = body(ctx);
      const kind = oneOf(input.kind, EMAIL_KINDS);
      const content = parseContent(input.content);
      if (!kind || !content) return ctx.badRequest("Invalid email");
      // The answer lists donors' names and addresses.
      await auditLog(ctx, "emails.check", undefined, {
        onceWithinMinutes: AUDIT_EDITING_MINUTES,
      });
      return ctx.send({
        data: await service.check(kind, content, parseAudience(input.audience)),
      });
    },

    /** The email as it is in the editor, as a donor in its group gets it. */
    async preview(ctx: Context) {
      const input = body(ctx);
      const kind = oneOf(input.kind, EMAIL_KINDS);
      const content = parseContent(input.content);
      if (!kind || !content) return ctx.badRequest("Invalid email");
      const donorId = Number(input.donorId);
      await auditLog(ctx, "emails.preview", undefined, {
        onceWithinMinutes: AUDIT_EDITING_MINUTES,
      });
      return ctx.send({
        data: await service.preview(
          kind,
          content,
          parseAudience(input.audience),
          Number.isInteger(donorId) && donorId > 0 ? donorId : null,
          typeof input.locale === "string" ? input.locale : null,
          parseTraits(input.traits),
        ),
      });
    },

    /**
     * A picture for an email: one JPEG, PNG, GIF or WebP, by its bytes, as
     * the `files` form field, with its description as `description`. Into
     * the media library; its address comes back. Only a signed-in admin with
     * this permission gets here: the route's auth refuses everyone else.
     */
    async uploadImage(ctx: Context) {
      const user = currentUser(ctx);
      if (!user) return ctx.unauthorized("Not signed in");
      const upload = uploadedFile(ctx);
      if (!upload) return ctx.badRequest("Send one picture as the files field");
      // checked before reading it in
      if (upload.size > MAX_IMAGE_BYTES) {
        return ctx.payloadTooLarge(
          `The picture is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB`,
        );
      }
      const type = imageType(await readFile(upload.path));
      if (!type) {
        return ctx.unsupportedMediaType(
          "Only JPEG, PNG, GIF and WebP pictures can be added",
        );
      }
      const fields: unknown = ctx.request.body;
      const description = cleanDescription(
        isRecord(fields) ? fields.description : undefined,
      );
      if (!description) {
        return ctx.badRequest("Describe what the picture shows");
      }

      let stored: { id: number; url: string } | null;
      try {
        stored = await service.uploadImage(upload, type, description);
      } catch (error) {
        // The media library refuses a file that isn't a valid picture.
        strapi.log.warn(`Email picture refused: ${String(error)}`);
        return ctx.badRequest("The file isn't a picture that can be used");
      }
      if (!stored) return ctx.internalServerError("The picture wasn't stored");

      await auditLog(ctx, "emails.uploadImage", `#${stored.id} ${type.mime}`);
      return ctx.created({ data: { url: stored.url, description } });
    },

    /** The saved email, to the signed-in admin's own address. */
    async test(ctx: Context) {
      const campaign = await find(ctx);
      if (!campaign) return;
      const user = currentUser(ctx);
      if (!user) return ctx.unauthorized("Not signed in");
      try {
        await service.sendTest(campaign, kindOf(campaign), user.email);
      } catch (error) {
        strapi.log.error(
          `Email ${campaign.id}'s test wasn't sent: ${String(error)}`,
        );
        return ctx.serviceUnavailable(
          `The test couldn't be sent: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      await auditLog(ctx, "emails.test", String(campaign.id));
      return ctx.send({ data: { to: user.email } });
    },

    async send(ctx: Context) {
      const campaign = await find(ctx);
      if (!campaign) return;
      const kind = kindOf(campaign);
      let recipients: Recipient[] | undefined;
      if (campaign.status === "draft") {
        recipients = await emailCampaignsRepository.findRecipients(
          kind,
          campaign.audience,
        );
        const [error] = await service.errors(
          kind,
          campaign.content,
          campaign.audience,
          recipients,
        );
        if (error) return ctx.badRequest(error.message);
        if (recipients.length === 0) {
          return ctx.badRequest("No donors are in this group");
        }
        // How many the admin was told it goes to, and agreed to: a draft
        // isn't sent without it.
        const count = body(ctx).count;
        if (typeof count !== "number") {
          return ctx.badRequest("Say how many donors it's to go to");
        }
        if (count !== recipients.length) {
          return ctx.conflict(
            `The group has changed: it's ${recipients.length} ${recipients.length === 1 ? "donor" : "donors"} now. Look it over and send again.`,
          );
        }
      }
      if (!(await service.start(campaign, kind, { recipients }))) {
        return ctx.conflict(
          "The email was changed or sent from somewhere else just now. Look it over and send again.",
        );
      }
      await auditLog(ctx, "emails.send", String(campaign.id));
      return ctx.send({ data: { id: campaign.id } });
    },
  };
};
