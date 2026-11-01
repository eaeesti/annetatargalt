import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { donorsRepository } from "../../../db/repositories";
import { emailTokenSecret } from "../../../emails";
import { EMAIL_KINDS } from "../../../utils/email-campaign";
import {
  preferenceChanges,
  unsubscribing,
} from "../../../utils/email-preferences";
import { donorIdFromToken } from "../../../utils/email-token";
import { isRecord, oneOf } from "../../../utils/narrow";

/**
 * What the page shows: the address the emails go to, and which ones it gets.
 * Those are the address's, from every donor row with it, as sending decides
 * them: one row's alone could show an email as on that the address doesn't
 * get, and saving it would turn it back on.
 */
async function preferencesOf(donorId: number) {
  const donor = await donorsRepository.findById(donorId);
  const preferences = await donorsRepository.findEmailPreferences(donorId);
  if (!donor || !preferences) return null;
  return {
    email: donor.email,
    newsletter: preferences.newsletter,
    transferEmails: preferences.transferEmails,
    yearlyEmails: preferences.yearlyEmails,
  };
}

/**
 * Which emails a donor gets, besides the confirmations of their donations,
 * for the page the link in each email leads to.
 */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  /** A request's body, and the donor its token is for, if it's a valid one. */
  function read(ctx: Context) {
    const body = isRecord(ctx.request.body) ? ctx.request.body : {};
    return {
      body,
      donorId: donorIdFromToken(body.token, emailTokenSecret(strapi)),
    };
  }

  return {
    async find(ctx: Context) {
      const { donorId } = read(ctx);
      const preferences = donorId ? await preferencesOf(donorId) : null;
      if (!preferences) return ctx.notFound("Unknown link");
      ctx.body = preferences;
    },

    async update(ctx: Context) {
      const { body, donorId } = read(ctx);
      if (!donorId) return ctx.notFound("Unknown link");

      const parsed = preferenceChanges(body);
      if ("error" in parsed) return ctx.badRequest(parsed.error);

      await donorsRepository.updateEmailPreferences(donorId, parsed.changes);
      const preferences = await preferencesOf(donorId);
      if (!preferences) return ctx.notFound("Unknown link");
      ctx.body = preferences;
    },

    /**
     * Stop the kind of email the unsubscribe button was in, or, from a
     * confirmation, every kind there is.
     */
    async unsubscribe(ctx: Context) {
      const { body, donorId } = read(ctx);
      const kind = body.kind === "all" ? "all" : oneOf(body.kind, EMAIL_KINDS);
      if (!donorId || !kind) return ctx.notFound("Unknown link");

      const donor = await donorsRepository.updateEmailPreferences(
        donorId,
        unsubscribing(kind),
      );
      if (!donor) return ctx.notFound("Unknown link");
      ctx.body = { ok: true };
    },
  };
};
