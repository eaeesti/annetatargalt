import { factories } from "@strapi/strapi";
import type { Context } from "koa";

export default factories.createCoreController(
  "api::email-config.email-config",
  ({ strapi }) => ({
    async sendEmail(ctx: Context) {
      const { to, subject, text, html } = ctx.request.body;

      if (!to || !subject || !text || !html) {
        return ctx.badRequest("Missing required fields");
      }

      const emailConfig = await strapi.db
        .query("api::email-config.email-config")
        .findOne();

      await strapi.plugins["email"].services.email.send({
        to,
        replyTo: emailConfig.confirmationReplyTo,
        subject,
        text,
        html,
      });

      return ctx.send();
    },
  })
);
