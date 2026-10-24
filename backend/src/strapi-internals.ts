import type { Core } from "@strapi/strapi";

/*
 * Strapi's own tables and services, typed. Strapi types its query engine and
 * its services loosely, so this is the one place the backend says what their
 * rows and methods look like, instead of a cast at every call. Our own
 * content types go through `strapi.documents`, which the generated types
 * cover, and our own database through Drizzle.
 */

type QueryUid = Parameters<Core.Strapi["db"]["query"]>[0];
type Query = ReturnType<Core.Strapi["db"]["query"]>;

/** Strapi's query engine for one table, with rows of the type the caller names. */
export function strapiTable<Row>(strapi: Core.Strapi, uid: QueryUid) {
  const query = strapi.db.query(uid);
  return {
    findOne: (params: Parameters<Query["findOne"]>[0]): Promise<Row | null> =>
      query.findOne(params),
    findMany: (params: Parameters<Query["findMany"]>[0]): Promise<Row[]> =>
      query.findMany(params),
    create: (params: Parameters<Query["create"]>[0]): Promise<Row> =>
      query.create(params),
  };
}

/** The i18n plugin's languages. */
export function i18nLocales(strapi: Core.Strapi) {
  const service = strapi.plugin("i18n").service("locales");
  return {
    find: (): Promise<{ code: string }[]> => service.find(),
    create: (locale: { code: string; name: string }): Promise<unknown> =>
      service.create(locale),
    getDefaultLocale: (): Promise<string | null> => service.getDefaultLocale(),
    setDefaultLocale: (params: { code: string }): Promise<unknown> =>
      service.setDefaultLocale(params),
  };
}

/** Whether the i18n plugin treats a content type as translatable. */
export function isLocalizedContentType(
  strapi: Core.Strapi,
  contentType: unknown,
): boolean {
  return strapi
    .plugin("i18n")
    .service("content-types")
    .isLocalizedContentType(contentType);
}

/** The admin's API tokens. */
export function apiTokens(strapi: Core.Strapi) {
  const service = strapi.service("admin::api-token");
  return {
    create: (data: Record<string, unknown>): Promise<{ accessKey: string }> =>
      service.create(data),
    update: (id: number, data: Record<string, unknown>): Promise<unknown> =>
      service.update(id, data),
  };
}

/** A users-permissions session token for the user with this id. */
export function issueUserJwt(strapi: Core.Strapi, id: number): Promise<string> {
  return strapi.plugin("users-permissions").service("jwt").issue({ id });
}
