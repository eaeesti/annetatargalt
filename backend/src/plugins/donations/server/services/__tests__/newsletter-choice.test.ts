import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Core } from "@strapi/strapi";
import serviceFactory from "../donation";

const donorService = {
  findOrCreateDonor: vi.fn(),
  findOrCreateDonorByEmail: vi.fn(),
  applyNewsletterChoice: vi.fn(),
};
const service = serviceFactory({
  // oxlint-disable-next-line typescript/consistent-type-assertions
  strapi: {
    plugin: () => ({ service: () => donorService }),
    log: { error: vi.fn() },
  } as unknown as Core.Strapi,
});
const createSingleDonation = vi.spyOn(service, "createSingleDonation");

/** A one-off donation by someone who typed `email`, for donor Mari. */
function donating(email: string, newsletter: boolean) {
  return service.createDonation({
    firstName: "Mari",
    lastName: "Maasikas",
    email,
    idCode: "38207162722",
    amount: 1000,
    type: "onetime",
    paymentMethod: "paymentInitiation",
    newsletter,
    amounts: [{ organizationInternalId: "org-a", amount: 1000 }],
  });
}

describe("the newsletter choice on the donation form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(service, "validateDonation").mockResolvedValue({ valid: true });
    createSingleDonation.mockResolvedValue({ redirectURL: "https://pay" });
    // Found by the ID code, with the address on file
    donorService.findOrCreateDonor.mockResolvedValue({
      id: 3,
      email: "mari@example.org",
    });
  });

  it("counts a no from the donor's own address at once", async () => {
    await donating(" Mari@Example.org", false);

    expect(donorService.applyNewsletterChoice).toHaveBeenCalledWith(3, false);
    expect(createSingleDonation).toHaveBeenCalledWith(
      expect.objectContaining({
        donation: expect.objectContaining({ newsletter: false }),
      }),
    );
  });

  it("keeps a yes with the donation, to count once it's paid", async () => {
    await donating("mari@example.org", true);

    expect(donorService.applyNewsletterChoice).not.toHaveBeenCalled();
    expect(createSingleDonation).toHaveBeenCalledWith(
      expect.objectContaining({
        donation: expect.objectContaining({ newsletter: true }),
      }),
    );
  });

  it("ignores a choice made with someone else's ID code", async () => {
    await donating("someone@example.org", false);

    expect(donorService.applyNewsletterChoice).not.toHaveBeenCalled();
    expect(createSingleDonation).toHaveBeenCalledWith(
      expect.objectContaining({
        donation: expect.objectContaining({ newsletter: undefined }),
      }),
    );
  });
});
