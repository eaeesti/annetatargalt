import Summary from "./Summary";

interface OrganizationDonation {
  organization: {
    title: string | null;
    slug: string | null;
    cause?: { slug: string | null } | null;
  };
  amount: number;
}

interface DecodedDonation {
  organizationDonations: OrganizationDonation[];
  amount: number;
}

interface DonationSummaryProps {
  donation: DecodedDonation;
  currency: string | null;
  totalText: string | null;
}

export default function DonationSummary({ donation, currency, totalText }: DonationSummaryProps) {
  const summary = donation.organizationDonations.map(
    (organizationDonation) => ({
      title: organizationDonation.organization.title ?? "",
      href: organizationDonation.organization.cause
        ? `/${organizationDonation.organization.cause.slug ?? ""}/${organizationDonation.organization.slug ?? ""}`
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
