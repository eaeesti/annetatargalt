"use strict";

const { resizeOrganizationDonations } = require("../../../../utils/donation");
const {
  organizationDonationsRepository,
} = require("../../../../db/repositories");

module.exports = ({ strapi }) => ({
    async createOrganizationDonations({ donationId, amounts }) {
      // Convert organization IDs to internalIds and create organization donations
      const organizationDonationsData = await Promise.all(
        amounts.map(async ({ organizationId, amount }) => {
          const organization = await strapi.entityService.findOne(
            "api::organization.organization",
            organizationId,
            { fields: ["internalId"] }
          );

          if (!organization || !organization.internalId) {
            throw new Error(
              `Organization ${organizationId} not found or missing internalId`
            );
          }

          return {
            donationId,
            organizationInternalId: organization.internalId,
            amount,
          };
        })
      );

      // Create organization donations in Drizzle
      return organizationDonationsRepository.createMany(
        organizationDonationsData
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

      // Map resized organization donations to Drizzle format
      // The resized donations should already have organizationInternalId
      const organizationDonationsData = resizedOrganizationDonations.map(
        (orgDonation) => ({
          donationId,
          organizationInternalId: orgDonation.organizationInternalId,
          amount: orgDonation.amount,
        })
      );

      // Create organization donations in Drizzle
      return organizationDonationsRepository.createMany(
        organizationDonationsData
      );
    },

    async createFromArray({ donationId, organizationDonations }) {
      // Convert organization IDs to internalIds and create organization donations
      const organizationDonationsData = await Promise.all(
        organizationDonations.map(async (organizationDonation) => {
          const organization = await strapi.entityService.findOne(
            "api::organization.organization",
            organizationDonation.organization,
            { fields: ["internalId"] }
          );

          if (!organization || !organization.internalId) {
            throw new Error(
              `Organization ${organizationDonation.organization} not found or missing internalId`
            );
          }

          return {
            donationId,
            organizationInternalId: organization.internalId,
            amount: organizationDonation.amount,
          };
        })
      );

      // Create organization donations in Drizzle
      return organizationDonationsRepository.createMany(
        organizationDonationsData
      );
    },
  });
