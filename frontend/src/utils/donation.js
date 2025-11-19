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

export function makeForeignDonationRequest(donation) {
  return fetch(getStrapiURL("/api/donateForeign"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(donation),
  });
}
