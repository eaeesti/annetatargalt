import { describe, it, expect, vi } from "vitest";
import type { Context } from "koa";

const send = vi.fn(async () => undefined);
const emailConfig = {
  contactFormSubmissionRecipients: "team@example.org",
  contactFormSubmissionSubject: "Message from <%= name %>",
  contactFormSubmissionText:
    "<%= name %> (<%= email %>) wrote:\n\n<%= message %>",
  contactFormSubmissionHtml:
    "<p><%= name %> (<%= email %>) wrote:</p>\n\n<pre><%= message %></pre>",
};

const fakeStrapi = {
  documents: (uid: string) =>
    uid === "api::email-config.email-config"
      ? { findFirst: async () => emailConfig }
      : { create: async () => ({}) },
  plugins: { email: { services: { email: { send } } } },
};

// Stand in for Strapi's factory: hand back the controller builder itself.
vi.mock("@strapi/strapi", () => ({
  factories: {
    createCoreController: (_uid: string, build: unknown) => build,
  },
}));

const { default: controllerFactory } = await import("../contact-submission");

function fakeCtx(body: Record<string, unknown>) {
  // A test double for Koa's context, which can't be built whole in a test.
  // oxlint-disable-next-line typescript/consistent-type-assertions
  return {
    request: { body, ip: "203.0.113.7" },
    send: vi.fn((data: unknown, status?: number) => ({ data, status })),
    badRequest: vi.fn((message: string) => ({ badRequest: message })),
  } as unknown as Context;
}

describe("contact submission email", () => {
  it("escapes the visitor's values in the HTML, and only there", async () => {
    const controller = controllerFactory({ strapi: fakeStrapi });
    const result = await controller.contact(
      fakeCtx({
        name: 'Mallory <a href="https://evil.example">',
        email: "mallory@example.org",
        message: "Click <b>here</b> & win",
      }),
    );

    expect(result).toEqual({ data: null, status: 204 });
    expect(send).toHaveBeenCalledWith({
      to: "team@example.org",
      replyTo: "mallory@example.org",
      subject: 'Message from Mallory <a href="https://evil.example">',
      text: 'Mallory <a href="https://evil.example"> (mallory@example.org) wrote:\n\nClick <b>here</b> & win',
      html: "<p>Mallory &lt;a href=&quot;https://evil.example&quot;&gt; (mallory@example.org) wrote:</p>\n\n<pre>Click &lt;b&gt;here&lt;/b&gt; &amp; win</pre>",
    });
  });
});
