import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../analytics";

type Umami = NonNullable<Window["umami"]>;

let plausible: ReturnType<typeof vi.fn<(eventName: string) => void>>;
let umami: { track: ReturnType<typeof vi.fn<Umami["track"]>> };
let onLoad: (() => void)[];

function stubBrowser({ loaded = true, scripts = true } = {}) {
  plausible = vi.fn<(eventName: string) => void>();
  umami = { track: vi.fn<Umami["track"]>() };
  onLoad = [];
  vi.stubGlobal("window", {
    plausible: scripts ? plausible : undefined,
    umami: scripts ? umami : undefined,
    addEventListener: (_: string, listener: () => void) =>
      onLoad.push(listener),
  });
  vi.stubGlobal("document", { readyState: loaded ? "complete" : "loading" });
}

beforeEach(() => stubBrowser());
afterEach(() => vi.unstubAllGlobals());

describe("track", () => {
  it("sends Umami the event with its properties, leaving out unset ones", () => {
    track("donation:submitted", {
      type: "recurring",
      amount: 20,
      tip: false,
      payment_method: undefined,
      company: false,
      dedication: false,
      from_link: true,
    });

    expect(umami.track).toHaveBeenCalledWith("donation:submitted", {
      type: "recurring",
      amount: 20,
      tip: false,
      company: false,
      dedication: false,
      from_link: true,
    });
  });

  it("sends Umami an event without properties as just its name", () => {
    track("page:not-found");

    expect(umami.track).toHaveBeenCalledWith("page:not-found", undefined);
  });

  // Plausible's goals are counted by these names, so they mustn't change
  // while it runs.
  const oldNames: [() => void, string][] = [
    [
      () => track("button:clicked", { button: "hero-donate-button" }),
      "hero-donate-button",
    ],
    [
      () => track("faq:expanded", { question: "faq-tax-deductible" }),
      "faq-tax-deductible",
    ],
    [() => track("page:not-found"), "404"],
    [
      () =>
        track("donation-form:step-opened", { step: "info", type: "onetime" }),
      "donation-info-stage",
    ],
    [
      () =>
        track("donation-form:step-opened", {
          step: "support",
          type: "onetime",
        }),
      "donation-support-stage",
    ],
    [
      () =>
        track("donation-form:step-opened", {
          step: "summary",
          type: "onetime",
        }),
      "donation-summary-stage",
    ],
    [
      () =>
        track("donation:submitted", {
          type: "onetime",
          amount: 20,
          tip: true,
          payment_method: "card",
          company: false,
          dedication: false,
          from_link: false,
        }),
      "donation-clicked",
    ],
    [
      () => track("donation:failed", { type: "onetime", reason: "server" }),
      "donation-error",
    ],
    [
      () => track("recurring-donation:created", { amount: 20 }),
      "donation-recurring-created",
    ],
    [
      () => track("donation:paid", { revenue: 21, currency: "EUR" }),
      "donation-paid",
    ],
    [
      () => track("foreign-donation:submitted", { amount: 20 }),
      "foreign-donation-clicked",
    ],
    [
      () => track("foreign-donation:failed", { reason: "network" }),
      "foreign-donation-error",
    ],
    [() => track("contact-form:sent"), "contact-form-sent"],
    [
      () => track("income:calculated", { adults: 2, children: 1 }),
      "income-calculated",
    ],
    [
      () => track("income-comparison:changed", { amount: 40 }),
      "income-comparison-changed",
    ],
    [
      () => track("income:shared", { network: "bluesky" }),
      "income-shared-bluesky",
    ],
  ];
  it.each(
    oldNames.map(([send, oldName]): [string, () => void] => [oldName, send]),
  )("sends Plausible %s, the name it always had", (oldName, send) => {
    send();

    expect(plausible.mock.calls).toEqual([[oldName]]);
  });

  it("holds events from before the scripts ran until the page has loaded", () => {
    stubBrowser({ loaded: false, scripts: false });

    track("donation:paid", { revenue: 21, currency: "EUR" });
    track("page:not-found");

    // Plausible's queue is the one its script reads when it starts
    expect(window.plausible?.q).toEqual([["donation-paid"], ["404"]]);

    window.umami = umami;
    for (const listener of onLoad) listener();
    expect(onLoad).toHaveLength(1);
    expect(umami.track.mock.calls).toEqual([
      ["donation:paid", { revenue: 21, currency: "EUR" }],
      ["page:not-found", undefined],
    ]);
  });

  it("drops Umami's events after the page loaded without it: it was blocked", () => {
    stubBrowser({ loaded: true, scripts: false });

    track("contact-form:sent");

    expect(onLoad).toHaveLength(0);
  });
});
