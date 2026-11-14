import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import {
  cardLogoUrl,
  cardPhotoUrl,
  LOGO_SIZE,
  SHARE_CARD_SIZE,
  type ShareCard,
  type SharePhoto,
  shorten,
  titleFontSize,
} from "./share-card";

const { width, height } = SHARE_CARD_SIZE;

/** primary-800, behind cards without a photo */
const CARD_GREEN = "#065f46";

type Fonts = NonNullable<
  NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]
>;

/**
 * The renderer (Satori) takes neither WOFF2 nor variable fonts, so the cards
 * use static WOFF files of the site's Inter. Each comes in two files, Latin
 * and Latin Extended (š, ž), which need different names: of two fonts with
 * one name, Satori only uses the first. next.config.mjs puts these files in
 * the server's build, as nothing imports them.
 */
const FONT_DIR = join(process.cwd(), "node_modules/@fontsource/inter/files");

async function loadAssets() {
  const [bold, boldExt, regular, regularExt, logo] = await Promise.all([
    readFile(join(FONT_DIR, "inter-latin-700-normal.woff")),
    readFile(join(FONT_DIR, "inter-latin-ext-700-normal.woff")),
    readFile(join(FONT_DIR, "inter-latin-400-normal.woff")),
    readFile(join(FONT_DIR, "inter-latin-ext-400-normal.woff")),
    // The logo in white, at twice the size it's drawn.
    readFile(join(process.cwd(), "assets/share-card/logo.png")),
  ]);
  const fonts: Fonts = [
    { name: "Inter", data: bold, weight: 700, style: "normal" },
    { name: "Inter Ext", data: boldExt, weight: 700, style: "normal" },
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter Ext", data: regularExt, weight: 400, style: "normal" },
  ];
  return { fonts, logo: `data:image/png;base64,${logo.toString("base64")}` };
}

let assets: ReturnType<typeof loadAssets> | undefined;

/**
 * The photo cropped to the card around its focus, as the hero crops it, as a
 * JPEG. Null if there's no photo or it can't be read, for a plain card.
 */
async function photoDataUrl(photo: SharePhoto | null): Promise<string | null> {
  if (!photo) return null;
  try {
    // Cloudinary's addresses name a version, so the file never changes.
    const response = await fetch(cardPhotoUrl(photo.url), {
      cache: "force-cache",
    });
    if (!response.ok) return null;
    const file = Buffer.from(await response.arrayBuffer());
    const { data, info } = await sharp(file)
      .rotate()
      .resize({ width, height, fit: "outside" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const jpeg = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .extract({
        left: Math.floor((info.width - width) / 2),
        top: Math.floor((info.height - height) * photo.focus),
        width,
        height,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * An organization's logo as the site shows it: its square file, on white, as
 * a PNG at twice the size it's drawn. Null if there's none or it can't be
 * read: the card is drawn without it.
 */
async function logoDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    // Cloudinary's addresses name a version, so the file never changes.
    const response = await fetch(cardLogoUrl(url), { cache: "force-cache" });
    if (!response.ok) return null;
    const png = await sharp(Buffer.from(await response.arrayBuffer()), {
      density: 300,
    })
      .resize({
        width: LOGO_SIZE * 2,
        height: LOGO_SIZE * 2,
        fit: "contain",
        background: "#ffffff",
      })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

// No textWrap: "balance": in Satori it pushes text that fits on one line
// off centre.
function cardElement(
  card: ShareCard,
  logo: string,
  photo: string | null,
  organizationLogo: string | null,
) {
  const title = shorten(card.title, 110);
  const subtitle = card.subtitle ? shorten(card.subtitle, 150) : null;
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // The words at the bottom, under the logo and name at the top.
        justifyContent: "flex-end",
        padding: "0 90px 64px",
        fontFamily: "Inter, Inter Ext",
        backgroundColor: CARD_GREEN,
      }}
    >
      {photo && (
        // oxlint-disable-next-line next/no-img-element -- drawn by Satori, not a page
        <img
          src={photo}
          alt=""
          width={width}
          height={height}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      )}
      {photo && (
        // The hero's primary-950 at 70%, deepening towards the words at the
        // bottom.
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            display: "flex",
            backgroundColor: "rgba(2, 44, 31, 0.72)",
            backgroundImage:
              "linear-gradient(to bottom, rgba(2, 28, 20, 0) 35%, rgba(2, 28, 20, 0.55) 100%)",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          top: 52,
          left: 0,
          width,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
        }}
      >
        {/* oxlint-disable-next-line next/no-img-element -- drawn by Satori, not a page */}
        <img src={logo} alt="" width={183} height={56} />
        <div
          style={{
            display: "flex",
            fontWeight: 700,
            fontSize: 38,
            letterSpacing: "-0.01em",
            color: "#ffffff",
          }}
        >
          {card.site}
        </div>
      </div>
      {organizationLogo && (
        // As on the organization's page: a rounded square with a shadow.
        // oxlint-disable-next-line next/no-img-element -- drawn by Satori, not a page
        <img
          src={organizationLogo}
          alt=""
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          style={{
            marginBottom: 34,
            borderRadius: 16,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.25)",
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          textAlign: "center",
          fontWeight: 700,
          fontSize: titleFontSize(title),
          lineHeight: 1.1,
          letterSpacing: "-0.025em",
          color: "#ffffff",
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            display: "flex",
            maxWidth: 920,
            marginTop: 26,
            textAlign: "center",
            fontWeight: 400,
            fontSize: 30,
            lineHeight: 1.45,
            // slate-200, as in the hero
            color: "#e2e8f0",
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

/**
 * The card as a JPEG: the renderer only makes PNGs, which are several times
 * larger for a photo, and WhatsApp skips large preview images.
 */
export async function shareCardResponse(card: ShareCard): Promise<Response> {
  assets ??= loadAssets();
  const [{ fonts, logo }, photo, organizationLogo] = await Promise.all([
    assets,
    photoDataUrl(card.photo),
    logoDataUrl(card.logo),
  ]);
  const element = cardElement(card, logo, photo, organizationLogo);
  const png = await new ImageResponse(element, {
    width,
    height,
    fonts,
  }).arrayBuffer();
  const jpeg = await sharp(Buffer.from(png))
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg" },
  });
}
