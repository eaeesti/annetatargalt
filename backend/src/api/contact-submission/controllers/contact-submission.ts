import { factories } from "@strapi/strapi";
import type { Context } from "koa";
import {
  FixedWindowLimiter,
  isProxyAddress,
} from "../../../utils/rate-limiter";

// Every submission both writes a row and sends mail through the org's account,
// from an endpoint the browser reaches directly with no challenge in front of
// it. The mail only ever goes to the configured internal recipients, so this
// can't be pointed at a stranger the way the recurring-donation mail can — but
// it can still be used to flood the team's inbox and burn the sending quota
// that donation receipts depend on. Five an hour is well clear of what a
// person filling in a contact form does.
const contactSubmissionsPerIp = new FixedWindowLimiter(5, 60 * 60 * 1000);

export default factories.createCoreController(
  "api::contact-submission.contact-submission",
  ({ strapi }) => ({
    async contact(ctx: Context) {
      const submission = ctx.request.body;

      // Skipped while SERVER_PROXY is off, when every visitor shares the
      // proxy's address and this would throttle the whole site at once.
      if (
        !isProxyAddress(ctx.request.ip) &&
        !contactSubmissionsPerIp.tryConsume(ctx.request.ip)
      ) {
        // Status must be passed to send() — Strapi's send(data, status = 200)
        // overwrites any ctx.status set beforehand.
        return ctx.send(
          { error: "Too many messages sent. Try again later." },
          429,
        );
      }

      try {
        await strapi
          .documents("api::contact-submission.contact-submission")
          .create({
            data: submission,
          });
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Failed to create contact submission");
      }

      const emailConfig = await strapi
        .documents("api::email-config.email-config")
        .findFirst();
      if (!emailConfig) {
        return ctx.badRequest("Email config not found");
      }

      const recipients = emailConfig.contactFormSubmissionRecipients;
      if (!recipients) {
        return ctx.badRequest("No recipient emails configured");
      }
      const recipientEmails = recipients.split(/\r\n|\r|\n/);

      const template = {
        subject: emailConfig.contactFormSubmissionSubject,
        text: emailConfig.contactFormSubmissionText,
        html: emailConfig.contactFormSubmissionHtml,
      };

      const emailPromises = recipientEmails.map((recipientEmail: string) =>
        strapi.plugins["email"].services.email.sendTemplatedEmail(
          {
            to: recipientEmail,
            replyTo: submission.email,
          },
          template,
          submission,
        ),
      );

      try {
        await Promise.all(emailPromises);
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Failed to send emails");
      }

      return ctx.send();
    },
  }),
);
