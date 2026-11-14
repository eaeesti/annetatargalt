import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import {
  cardPhotoUrl,
  SHARE_CARD_SIZE,
  type ShareCard,
  type SharePhoto,
  shorten,
  titleFontSize,
} from "./share-card";

const { width, height } = SHARE_CARD_SIZE;

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

// No textWrap: "balance": in Satori it pushes text that fits on one line
// off centre.
function cardElement(card: ShareCard, logo: string, photo: string | null) {
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
        justifyContent: "center",
        padding: "112px 90px 40px",
        fontFamily: "Inter, Inter Ext",
        // primary-900, lighter in the middle where there's no photo. (Satori
        // fails on a style that is present but undefined.)
        backgroundColor: "#064e3b",
        ...(photo
          ? {}
          : {
              backgroundImage:
                "radial-gradient(circle at 50% 45%, #047857 0%, #064e3b 55%, #022c1f 100%)",
            }),
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
        // The hero's primary-950 at 70%, a little deeper behind the words.
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
              "radial-gradient(circle at 50% 54%, rgba(2, 28, 20, 0.45) 0%, rgba(2, 28, 20, 0) 60%)",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          top: 44,
          left: 0,
          width,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {/* oxlint-disable-next-line next/no-img-element -- drawn by Satori, not a page */}
        <img src={logo} alt="" width={216} height={66} />
      </div>
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
  const [{ fonts, logo }, photo] = await Promise.all([
    assets,
    photoDataUrl(card.photo),
  ]);
  const png = await new ImageResponse(cardElement(card, logo, photo), {
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
