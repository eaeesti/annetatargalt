import Summary from "../Summary";
import Proportions from "@/utils/proportions";
import type { StrapiCause } from "@/types/generated/strapi";
import { pagePath } from "@/utils/locale";
import type { Locale } from "@/utils/locale";

interface Donation {
  proportions: Proportions;
  amount: number;
}

interface PaymentSummaryProps {
  donation: Donation;
  currency: string | null;
  causes: { data: StrapiCause[] };
  totalText: string | null;
  tipOrganization: string | null;
  tipAmount: number;
  totalAmount: number;
  locale: Locale;
}

export default function PaymentSummary({
  donation,
  currency,
  causes,
  totalText,
  tipOrganization,
  tipAmount,
  totalAmount,
  locale,
}: PaymentSummaryProps) {
  const organizationAmounts = donation.proportions.calculateAmounts(
    donation.amount,
    causes,
  );

  const tip = {
    title: tipOrganization ?? "",
    href: "",
    amount: tipAmount,
  };

  const summary = causes.data
    .map((cause) =>
      cause.organizations
        .filter((organization) =>
          organizationAmounts.some(
            ({ organizationInternalId }) =>
              organizationInternalId === organization.internalId,
          ),
        )
        .map((organization) => ({
          title: organization.title ?? "",
          href: pagePath(`${cause.slug}/${organization.slug}`, locale),
          amount:
            organizationAmounts.find(
              ({ organizationInternalId }) =>
                organizationInternalId === organization.internalId,
            )?.amount ?? 0,
        })),
    )
    .flat()
    .concat(tipAmount > 0 ? [tip] : []);

  return (
    <Summary
      summary={summary}
      currency={currency}
      totalText={totalText}
      locale={locale}
      totalAmount={totalAmount}
    />
  );
}
