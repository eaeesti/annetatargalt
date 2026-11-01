import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { isRecord } from "./utils/narrow";

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

export type EmailRecipient = {
  to: string | null;
  replyTo?: string | null;
  headers?: Record<string, string>;
};
export type EmailTemplate = {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
};

/** An email as the email plugin sends it, without a template. */
export interface MailMessage {
  to: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}

/** The email plugin, with the methods the backend's emails use. */
export function emailService(strapi: Core.Strapi) {
  const service = strapi.plugin("email").service("email");
  return {
    sendTemplatedEmail: (
      recipient: EmailRecipient,
      template: EmailTemplate,
      data: Record<string, unknown>,
    ): Promise<void> => service.sendTemplatedEmail(recipient, template, data),
    send: (options: MailMessage): Promise<void> => service.send(options),
  };
}

/** A users-permissions session token for the user with this id. */
export function issueUserJwt(strapi: Core.Strapi, id: number): Promise<string> {
  return strapi.plugin("users-permissions").service("jwt").issue({ id });
}

/**
 * The user a request's users-permissions token is for, when it has one that
 * this backend signed and that hasn't expired; null otherwise. Whether the
 * user may do anything is for the route to decide.
 */
export async function tokenUserId(
  strapi: Core.Strapi,
  ctx: Context,
): Promise<number | null> {
  try {
    const payload: unknown = await strapi
      .plugin("users-permissions")
      .service("jwt")
      .getToken(ctx);
    return isRecord(payload) && typeof payload.id === "number"
      ? payload.id
      : null;
  } catch {
    return null;
  }
}

/** A file for the upload service, as koa's body parser leaves one on disk. */
interface FileOnDisk {
  filepath: string;
  originalFilename: string;
  mimetype: string;
  /** The type found from the file's own bytes, which the service prefers. */
  detectedMimeType: string;
  size: number;
}

/**
 * The media library's upload service: stores a file with the upload
 * provider, Cloudinary, after checking that a picture is a valid one.
 */
export function mediaLibrary(strapi: Core.Strapi) {
  const service = strapi.plugin("upload").service("upload");
  return {
    upload: (
      file: FileOnDisk,
      fileInfo: { name: string; alternativeText: string },
    ): Promise<{ id: number; url: string }[]> =>
      service.upload({ data: { fileInfo }, files: file }),
  };
}
