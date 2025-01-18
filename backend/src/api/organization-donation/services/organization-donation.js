"use strict";

const { createCoreService } = require("@strapi/strapi").factories;
const { resizeOrganizationDonations } = require("../../../utils/donation");

module.exports = createCoreService(
  "api::organization-donation.organization-donation",
  ({ strapi }) => ({
    async createOrganizationDonations({ donationId, amounts }) {
      return Promise.all(
        amounts.map(async ({ organizationId, amount }) => {
          await strapi.entityService.create(
            "api::organization-donation.organization-donation",
            {
              data: {
                donation: donationId,
                organization: organizationId,
                amount,
              },
            }
          );
        })
      );
    },

    async createFromOrganizationRecurringDonations({
      donationId,
      donationAmount,
      recurringDonationAmount,
      organizationRecurringDonations,
    }) {
      const donationMultiplier = donationAmount / recurringDonationAmount;

      const resizedOrganizationDonations = resizeOrganizationDonations(
        organizationRecurringDonations,
        donationMultiplier,
        donationAmount
      );

      return Promise.all(
        resizedOrganizationDonations.map(
          async (organizationRecurringDonation) => {
            await strapi.entityService.create(
              "api::organization-donation.organization-donation",
              {
                data: {
                  donation: donationId,
                  organization: organizationRecurringDonation.organization.id,
                  amount: organizationRecurringDonation.amount,
                },
              }
            );
          }
        )
      );
    },

    async createFromArray({ donationId, organizationDonations }) {
      return Promise.all(
        organizationDonations.map(async (organizationDonation) => {
          await strapi.entityService.create(
            "api::organization-donation.organization-donation",
            {
              data: {
                donation: donationId,
                organization: organizationDonation.organization,
                amount: organizationDonation.amount,
              },
            }
          );
        })
      );
    },
  })
);
