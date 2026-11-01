import { afterEach, describe, expect, it, vi } from "vitest";
import type { Core } from "@strapi/strapi";
import bootstrap, { destroy } from "../bootstrap";

const resumeCutOff = vi.fn(async () => {});

vi.mock("../services/email-campaign", () => ({
  createEmailCampaignService: () => ({ resumeCutOff }),
}));

// oxlint-disable-next-line typescript/consistent-type-assertions
const strapi = { log: { error: vi.fn() } } as unknown as Core.Strapi;

describe("going on with emails cut off while being sent", () => {
  afterEach(() => {
    destroy();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    resumeCutOff.mockClear();
  });

  it("happens in production, every minute", () => {
    vi.useFakeTimers();
    vi.stubEnv("NODE_ENV", "production");
    bootstrap({ strapi });
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(resumeCutOff).toHaveBeenCalledTimes(2);
  });

  it("never happens in development, even with production's database", () => {
    vi.useFakeTimers();
    vi.stubEnv("NODE_ENV", "development");
    bootstrap({ strapi });
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(resumeCutOff).not.toHaveBeenCalled();
  });
});
