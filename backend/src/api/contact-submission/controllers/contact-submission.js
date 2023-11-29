"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::contact-submission.contact-submission",
  ({ strapi }) => ({
    async contact(ctx) {
      const submission = ctx.request.body;

      try {
        await strapi.entityService.create(
          "api::contact-submission.contact-submission",
          {
            data: submission,
          }
        );
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Failed to create contact submission");
      }

      const emailConfig = await strapi.db
        .query("api::email-config.email-config")
        .findOne();

      const recipientEmails =
        emailConfig.contactFormSubmissionRecipients.split(/\r\n|\r|\n/);

      const template = {
        subject: emailConfig.contactFormSubmissionSubject,
        text: emailConfig.contactFormSubmissionText,
        html: emailConfig.contactFormSubmissionHtml,
      };

      const emailPromises = recipientEmails.map((recipientEmail) =>
        strapi.plugins["email"].services.email.sendTemplatedEmail(
          {
            to: recipientEmail,
            replyTo: submission.email,
          },
          template,
          submission
        )
      );

      try {
        await Promise.all(emailPromises);
      } catch (error) {
        console.error(error);
        return ctx.badRequest("Failed to send emails");
      }

      return ctx.send();
    },
  })
);
