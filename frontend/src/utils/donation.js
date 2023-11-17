import { getStrapiURL } from "./strapi";

export function makeDonationRequest(donation) {
  return fetch(getStrapiURL("/api/donate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(donation),
  });
}

// Calculate amounts from proportions and avoid rounding errors
export function amountsFromProportions({ proportions, causes, totalAmount }) {
  const amounts = {};

  causes.data.forEach((cause) => {
    const causeProportion = proportions.getProportion(cause.id);
    cause.attributes.organizations.data.forEach((organization) => {
      const organizationProportion = proportions.getSubProportion(
        cause.id,
        organization.id,
      );
      const proportion = (causeProportion * organizationProportion) / 10000;
      const amount = totalAmount * proportion;
      const roundedAmount = Math.round(amount * 100) / 100;
      if (roundedAmount > 0) {
        amounts[organization.id] = roundedAmount;
      }
    });
  });

  const total = Object.values(amounts).reduce((a, b) => a + b, 0);
  if (total !== totalAmount) {
    const discrepancy = Math.round((totalAmount - total) * 100) / 100;
    const timesToAdd = Math.floor(Math.abs(discrepancy) / 0.01);
    const adder = discrepancy / timesToAdd;

    const keys = Object.keys(amounts);
    for (let i = 0; i < timesToAdd; i++) {
      const key = keys.at(-(i % keys.length) - 1);
      amounts[key] = Math.round((amounts[key] + adder) * 100) / 100;
    }
  }

  return amounts;
}
