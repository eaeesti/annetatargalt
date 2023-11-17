import { amountsFromProportions } from "@/utils/donation";
import Summary from "../Summary";

export default function PaymentSummary({
  donation,
  currency,
  causes,
  totalText,
}) {
  const organizationAmounts = amountsFromProportions({
    proportions: donation.proportions,
    causes: causes,
    totalAmount: donation.amount,
  });

  const summary = causes.data
    .map((cause) =>
      cause.attributes.organizations.data
        .filter(
          (organization) => organizationAmounts[organization.id] !== undefined,
        )
        .map((organization) => ({
          title: organization.attributes.title,
          href: `/${cause.attributes.slug}/${organization.attributes.slug}`,
          amount: organizationAmounts[organization.id],
        })),
    )
    .flat();

  return (
    <Summary
      summary={summary}
      currency={currency}
      totalText={totalText}
      totalAmount={donation.amount}
    />
  );
}
