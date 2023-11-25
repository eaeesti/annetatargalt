import Summary from "./Summary";

export default function DonationSummary({
  donation,
  currency,
  totalText,
  tipOrganization,
}) {
  const tip = {
    title: tipOrganization,
    href: "",
    amount: donation.tipAmount / 100,
  };

  const summary = donation.organizationDonations
    .map((organizationDonation) => ({
      title: organizationDonation.organization.title,
      href: `/${organizationDonation.organization.cause.slug}/${organizationDonation.organization.slug}`,
      amount: organizationDonation.amount / 100,
    }))
    .concat(donation.tipAmount > 0 ? [tip] : []);

  return (
    <Summary
      summary={summary}
      currency={currency}
      totalText={totalText}
      totalAmount={donation.amount / 100}
    />
  );
}
