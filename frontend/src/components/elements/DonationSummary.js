import Summary from "./Summary";

export default function DonationSummary({ donation, currency, totalText }) {
  const summary = donation.organizationDonations.map(
    (organizationDonation) => ({
      title: organizationDonation.organization.title,
      href: organizationDonation.organization.cause
        ? `/${organizationDonation.organization.cause.slug}/${organizationDonation.organization.slug}`
        : "",
      amount: organizationDonation.amount / 100,
    }),
  );

  return (
    <Summary
      summary={summary}
      currency={currency}
      totalText={totalText}
      totalAmount={donation.amount / 100}
    />
  );
}
