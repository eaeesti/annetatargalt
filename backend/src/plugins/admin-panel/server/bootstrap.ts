import type { Core } from "@strapi/strapi";
import { createEmailCampaignService } from "./services/email-campaign";

/** How often each backend process looks for sending that was cut off. */
const RESUME_EVERY_MS = 60 * 1000;

let resuming: ReturnType<typeof setInterval> | undefined;

/**
 * Goes on with emails whose sending was cut off, such as by a deploy: once
 * no process has sent their heartbeat for a while, one picks them up.
 *
 * Only in production. A copy of its database, made while it sends, would
 * otherwise have a backend in development take the send over and mail
 * from there. One cut off in development goes on with the button.
 */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  if (process.env.NODE_ENV !== "production") return;
  const service = createEmailCampaignService(strapi);
  resuming = setInterval(() => {
    service.resumeCutOff().catch((error: unknown) => {
      strapi.log.error(
        `Emails cut off while being sent weren't picked up: ${String(error)}`,
      );
    });
  }, RESUME_EVERY_MS);
  resuming.unref();
};

/**
 * On shutting down, takes up no more cut-off emails. Those being sent finish
 * the copy in hand once the server is closed, in the app's own destroy
 * (src/index.ts), and another process goes on with the rest.
 */
export function destroy() {
  clearInterval(resuming);
}
