/**
 * The slug a page, blog post, cause or organization is shown at on the site,
 * or null for anything else: only those have drafts to preview.
 */
async function previewSlug(uid, { documentId, locale, status }) {
  const findSlug = async () =>
    (
      await strapi
        .documents(uid)
        .findOne({ documentId, locale, status, fields: ["slug"] })
    )?.slug;

  if (uid === "api::page.page" || uid === "api::cause.cause") {
    return (await findSlug()) ?? null;
  }
  if (uid === "api::organization.organization") {
    // Shown under its cause, and only once it has one.
    const organization = await strapi.documents(uid).findOne({
      documentId,
      locale,
      status,
      fields: ["slug"],
      populate: { cause: { fields: ["slug"] } },
    });
    const causeSlug = organization?.cause?.slug;
    return organization?.slug && causeSlug
      ? `${causeSlug}/${organization.slug}`
      : null;
  }
  if (uid === "api::blog-post.blog-post") {
    const slug = await findSlug();
    const global = await strapi
      .documents("api::global.global")
      .findFirst({ locale, fields: ["blogSlug"] });
    return slug ? `${global?.blogSlug || "blog"}/${slug}` : null;
  }
  return null;
}

module.exports = ({ env }) => ({
  auth: {
    secret: env("ADMIN_JWT_SECRET"),
  },
  apiToken: {
    salt: env("API_TOKEN_SALT"),
  },
  transfer: {
    token: {
      salt: env("TRANSFER_TOKEN_SALT"),
    },
  },
  // The Preview button in the editor shows a page, blog post, cause or
  // organization on the site, drafts and all. The site's /api/preview turns
  // its draft mode on for a link with the secret both share, and the button
  // is hidden without one.
  preview: {
    enabled: Boolean(env("PREVIEW_SECRET")),
    config: {
      allowedOrigins: [env("FRONTEND_URL")],
      async handler(uid, { documentId, locale, status }) {
        const slug = await previewSlug(uid, { documentId, locale, status });
        if (typeof slug !== "string") return null;

        // The same path the site gives it: English under /en, Estonian at the
        // root, and the home page's slug is "/".
        const prefix = locale && locale !== "et" ? `/${locale}` : "";
        const path = `${prefix}${slug === "/" ? "" : `/${slug}`}` || "/";
        const params = new URLSearchParams({
          path,
          status: status ?? "draft",
          secret: env("PREVIEW_SECRET"),
        });
        return `${env("FRONTEND_URL")}/api/preview?${params}`;
      },
    },
  },
  // Optimize the Vite build for memory-constrained environments
  vite: {
    build: {
      // Disable minification for faster builds (admin panel, not critical for performance)
      minify: false,

      // Disable source maps (not needed in production)
      sourcemap: false,

      // Reduce chunk size warnings
      chunkSizeWarningLimit: 5000,

      // Optimize rollup for lower memory usage
      rollupOptions: {
        output: {
          // Reduce chunk splitting to lower memory usage
          manualChunks: undefined,
        },
      },
    },
  },
});
