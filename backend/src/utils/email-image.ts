/*
 * Pictures in the emails the team sends from the admin panel: which files
 * are taken, what their descriptions may hold, and how an email asks for one.
 */

/** The largest picture taken: plenty for an email, at 1200 pixels wide. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export interface ImageType {
  mime: string;
  extension: string;
}

/**
 * What kind of picture `data` is, from its first bytes rather than its name
 * or what the browser said: a JPEG, PNG, GIF or WebP, and null for anything
 * else. An SVG can carry scripts, and isn't taken.
 */
export function imageType(data: Buffer): ImageType | null {
  const startsWith = (bytes: number[], at = 0) =>
    data.length >= at + bytes.length &&
    bytes.every((byte, i) => data[at + i] === byte);
  const text = (from: number, to: number) =>
    data.subarray(from, to).toString("latin1");

  if (startsWith([0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", extension: "png" };
  }
  if (text(0, 6) === "GIF87a" || text(0, 6) === "GIF89a") {
    return { mime: "image/gif", extension: "gif" };
  }
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

export const MAX_DESCRIPTION_LENGTH = 300;

/**
 * A picture's description, fit to be its text in Markdown: one line, with
 * no brackets to end it early, and not too long. Empty when there's none.
 */
export function cleanDescription(value: unknown): string {
  if (typeof value !== "string") return "";
  return (
    value
      // oxlint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/[[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_DESCRIPTION_LENGTH)
  );
}

/**
 * Whether a picture is in the media library: on Cloudinary, in the account
 * the library uploads to. Another account's could change or go.
 */
export function isOurImage(url: string): boolean {
  const account = process.env.CLOUDINARY_NAME;
  return (
    Boolean(account) &&
    url.startsWith(`https://res.cloudinary.com/${account}/image/upload/`)
  );
}

/**
 * A picture from the media library as an email asks for it: at most 1200
 * pixels wide, twice the width an email shows it at, and as a JPEG unless
 * it's a PNG or a GIF. Many email clients show no WebP. Any other picture
 * is left as it is.
 */
export function emailPictureUrl(url: string): string {
  if (!isOurImage(url)) return url;
  const [path = "", query] = url.split("?");
  const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
  const kept = extension === "png" || extension === "gif" ? extension : "jpg";
  const withoutExtension = extension
    ? path.slice(0, -(extension.length + 1))
    : path;
  const resized = withoutExtension.replace(
    "/image/upload/",
    "/image/upload/c_limit,w_1200,q_auto/",
  );
  return `${resized}.${kept}${query === undefined ? "" : `?${query}`}`;
}
