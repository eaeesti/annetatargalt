import type { Core } from "@strapi/strapi";

/** Strapi's upload endpoints for the content API: /api/upload and under it. */
const CONTENT_UPLOAD = /^\/api\/upload(\/|$)/i;

/**
 * Refuses Strapi's own upload endpoints for the content API to everyone,
 * before any token is looked at. Bootstrap takes the permission away from
 * every role and token that has it (closeContentUpload), but a "Full access"
 * API token needs none: it reaches every route there is. Nothing of ours
 * uses them: Strapi's admin has upload routes of its own, and the admin
 * panel's pictures for emails go through an endpoint that checks them.
 */
const noContentUpload: Core.MiddlewareFactory = () => async (ctx, next) => {
  if (CONTENT_UPLOAD.test(ctx.path)) {
    ctx.status = 403;
    ctx.body = {
      data: null,
      error: {
        status: 403,
        name: "ForbiddenError",
        message: "Files aren't uploaded here",
        details: {},
      },
    };
    return;
  }
  await next();
};

export default noContentUpload;
