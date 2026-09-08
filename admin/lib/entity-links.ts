/**
 * Path builders for links between admin entities. Plain functions (no "use
 * client") so server components can call them during render.
 */

export const donationHref = (id: number | string) => `/donations/${id}`;
export const donorHref = (id: number | string) => `/donors/${id}`;
export const recurringDonationHref = (id: number | string) =>
  `/recurring-donations/${id}`;
export const transferHref = (id: number | string) => `/transfers/${id}`;
export const organizationHref = (internalId: string) =>
  `/organizations/${encodeURIComponent(internalId)}`;
/** The bank-transaction list, filtered to one archiving code (there is no detail page). */
export const bankTransactionHref = (archivingCode: string) =>
  `/transactions?search=${encodeURIComponent(archivingCode)}`;
