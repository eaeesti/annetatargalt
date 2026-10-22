import Summary from "./Summary";
import { pagePath } from "@/utils/locale";
import type { Locale } from "@/utils/locale";

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
  locale: Locale;
}

export default function DonationSummary({
  donation,
  currency,
  totalText,
  locale,
}: DonationSummaryProps) {
  const summary = donation.organizationDonations.map(
    (organizationDonation) => ({
      title: organizationDonation.organization.title ?? "",
      href: organizationDonation.organization.cause
        ? pagePath(
            `${organizationDonation.organization.cause.slug ?? ""}/${organizationDonation.organization.slug ?? ""}`,
            locale,
          )
        : "",
      amount: organizationDonation.amount / 100,
    }),
  );

  return (
    <Summary
      summary={summary}
      currency={currency}
      totalText={totalText}
      locale={locale}
      totalAmount={donation.amount / 100}
    />
  );
}
