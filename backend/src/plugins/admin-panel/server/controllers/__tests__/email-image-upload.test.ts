import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "koa";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import routes from "../../routes/emailCampaign";
import { MAX_IMAGE_BYTES } from "../../../../../utils/email-image";

const service = vi.hoisted(() => ({
  uploadImage: vi.fn(async () => ({
    id: 7,
    url: "https://res.cloudinary.com/x/image/upload/v1/email.png",
  })),
}));
vi.mock("../../services/email-campaign", () => ({
  createEmailCampaignService: () => service,
}));
vi.mock("../../../../../db/repositories", () => ({
  emailCampaignsRepository: {},
}));
vi.mock("../../utils/audit-log", () => ({ auditLog: vi.fn() }));

const { default: emailCampaignController } = await import("../emailCampaign");

// The handler uses Strapi only to log a refused picture.
// oxlint-disable-next-line typescript/consistent-type-assertions
const strapi = { log: { warn: vi.fn() } } as never;
const controller = emailCampaignController({ strapi });

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);
const HTML = Buffer.from("<!doctype html><script>alert(1)</script>");

const folder = await mkdtemp(join(tmpdir(), "email-image-test-"));
afterAll(() => rm(folder, { recursive: true, force: true }));

let files = 0;
/** A request with `data` as its one uploaded file, as koa's parser leaves it. */
async function upload(
  data: Buffer,
  {
    name = "picture.png",
    size = data.length,
    description = "Mari annetamas",
    signedIn = true,
  } = {},
) {
  const filepath = join(folder, `upload-${files++}`);
  await writeFile(filepath, data);
  const reply = (status: number) =>
    vi.fn((message: unknown) => ({ status, message }));
  // A test double for Koa's context, which can't be built whole in a test.
  // oxlint-disable-next-line typescript/consistent-type-assertions
  const ctx = {
    state: signedIn ? { user: { id: 1, email: "team@example.org" } } : {},
    request: {
      files: { files: { filepath, originalFilename: name, size } },
      body: { description },
    },
    unauthorized: reply(401),
    badRequest: reply(400),
    payloadTooLarge: reply(413),
    unsupportedMediaType: reply(415),
    internalServerError: reply(500),
    created: vi.fn((data: unknown) => ({ status: 201, data })),
  } as unknown as Context;
  return controller.uploadImage(ctx);
}

describe("uploading a picture for an email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is only for the signed-in", async () => {
    expect(await upload(PNG, { signedIn: false })).toMatchObject({
      status: 401,
    });
    expect(service.uploadImage).not.toHaveBeenCalled();
  });

  it("goes through Strapi's sign-in, which the route never turns off", () => {
    const route = routes.routes.find((r) => r.path === "/emails/images");
    expect(route?.method).toBe("POST");
    expect(route?.config).not.toHaveProperty("auth");
  });

  it("takes only pictures, by their bytes, not their names", async () => {
    for (const [data, name] of [
      [SVG, "picture.svg"],
      [HTML, "picture.png"],
    ] as const) {
      expect(await upload(data, { name })).toMatchObject({ status: 415 });
    }
    expect(service.uploadImage).not.toHaveBeenCalled();
  });

  it("refuses one too large before reading it", async () => {
    expect(await upload(PNG, { size: MAX_IMAGE_BYTES + 1 })).toMatchObject({
      status: 413,
    });
    expect(service.uploadImage).not.toHaveBeenCalled();
  });

  it("needs a description", async () => {
    expect(await upload(PNG, { description: " [ ] " })).toMatchObject({
      status: 400,
    });
    expect(service.uploadImage).not.toHaveBeenCalled();
  });

  it("stores a picture as the type its bytes are, with its description", async () => {
    const result = await upload(PNG, {
      name: "../../etc/evil.svg",
      description: "Mari [annetamas]\n",
    });

    expect(result).toMatchObject({
      status: 201,
      data: {
        data: {
          url: "https://res.cloudinary.com/x/image/upload/v1/email.png",
          description: "Mari annetamas",
        },
      },
    });
    expect(service.uploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ size: PNG.length }),
      { mime: "image/png", extension: "png" },
      "Mari annetamas",
    );
  });

  it("says so when the media library refuses it", async () => {
    service.uploadImage.mockRejectedValueOnce(new Error("not a valid image"));
    expect(await upload(PNG)).toMatchObject({ status: 400 });
  });
});
